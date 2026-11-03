import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAudioContext, unlockAudio } from '../../engine/audioContext.js'
import { emptyHits, hasHits, hitsToPattern, normalizeHits, setHit, stepFor, toggleHit, MAX_DRUM_BARS } from '../../engine/drumPart.js'
import { playClick } from '../../engine/metronome.js'
import { DRUM_LANES, MAX_BPM, MIN_BPM, STEPS } from '../../engine/pattern.js'
import { swingDelay } from '../../engine/sequencer.js'
import { createMaster, playDrum } from '../../engine/playback.js'
import { loadBeat } from '../../storage/beatStore.js'
import { barSeconds } from '../../engine/timeline.js'
import { addDrumPartToSong, currentSong, loadSongTimeline } from '../../storage/songParts.js'
import { PRESETS } from '../beats/presets.js'
import { useAudioEngine } from '../timeline/useAudioEngine.js'

const DRAFT_KEY = 'gala.drums.v1'
const LEAD_BEATS = 4
const mod = (n, m) => ((n % m) + m) % m
const clampBpm = (v) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(Number(v) || 100)))

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (d && typeof d === 'object') return d
  } catch {
    // unreadable draft
  }
  return {}
}

// Everything the Drum pads tool does. The screen only draws it.
export function useDrumPads() {
  const draft = useMemo(loadDraft, [])
  const [bars, setBarsState] = useState(draft.bars ?? 1)
  const [bpm, setBpmState] = useState(draft.bpm ?? (loadBeat() ?? PRESETS[0].pattern).bpm)
  const [hits, setHits] = useState(() => normalizeHits(draft.hits, draft.bars ?? 1))
  const [swing, setSwingState] = useState(draft.swing ?? 0)
  const [backing, setBacking] = useState(draft.backing ?? 'song') // what plays under you: song | none
  const [hearPart, setHearPart] = useState(true)
  const [includeDrums, setIncludeDrums] = useState(false)
  const [songBpm, setSongBpm] = useState(null)
  const [notice, setNotice] = useState('')
  const [click, setClick] = useState(true)
  const [countIn, setCountIn] = useState(true)
  const [partName, setPartName] = useState(draft.partName ?? 'Drum idea')
  const [mode, setMode] = useState('idle') // idle | counting | recording | playing
  const [position, setPosition] = useState(0) // steps into the part
  const [flash, setFlash] = useState(() => new Set())
  const [song, setSong] = useState(null)
  const [saved, setSaved] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [canUndo, setCanUndo] = useState(false)

  const hitsRef = useRef(hits)
  hitsRef.current = hits
  const live = useRef({ bars, bpm, click, countIn, swing, backing, hearPart, includeDrums })
  const backingRef = useRef(null)
  const getBacking = useCallback(() => backingRef.current, [])
  const { api: engine } = useAudioEngine({ getTimeline: getBacking })
  live.current = { bars, bpm, click, countIn, swing, backing, hearPart, includeDrums }
  const sessionRef = useRef(null)
  const historyRef = useRef([])
  const masterRef = useRef(null)

  useEffect(() => {
    let alive = true
    currentSong()
      .then((project) => {
        if (!alive || !project) return
        setSong(project)
        if (!draft.bpm && project.beat) setBpmState(project.beat.bpm)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [draft.bpm])

  useEffect(() => {
    if (backing !== 'song') return undefined
    let alive = true
    loadSongTimeline()
      .then((song) => alive && setSongBpm(song ? song.timeline.bpm : null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [backing])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ backing, bars, bpm, hits, partName, swing }))
    } catch {
      // not remembered
    }
  }, [backing, bars, bpm, hits, partName, swing])

  const audio = useCallback(() => {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') unlockAudio().catch(() => {})
    if (masterRef.current?.ctx !== ctx) masterRef.current = createMaster(ctx)
    return masterRef.current
  }, [])

  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-19), hitsRef.current]
    setCanUndo(true)
  }, [])

  const endSession = useCallback(() => {
    const session = sessionRef.current
    sessionRef.current = null
    if (!session) return
    window.clearInterval(session.timer)
    engine.engineRef.current?.player.stop()
    session.gate.gain.setValueAtTime(0, session.ctx.currentTime)
    session.gate.disconnect()
    setMode('idle')
    setPosition(0)
  }, [engine])

  const stop = useCallback(() => endSession(), [endSession])

  const hit = useCallback(
    (laneId) => {
      const ctx = audio().ctx
      playDrum(ctx, audio().input, laneId, ctx.currentTime)
      setFlash((f) => new Set(f).add(laneId))
      window.setTimeout(
        () =>
          setFlash((f) => {
            const next = new Set(f)
            next.delete(laneId)
            return next
          }),
        110,
      )
      const session = sessionRef.current
      if (session?.recording && session.mode === 'recording') {
        const abs = Math.round(((ctx.currentTime - session.t0) / session.beatSec) * 4)
        if (abs < 0) return
        const step = stepFor(abs / 4, session.bars)
        session.skip.add(`${laneId}:${abs}`)
        if (!hitsRef.current[laneId][step]) {
          // overdubbing: the history entry is made once per take, when it starts
          setHits((h) => setHit(h, laneId, step))
        }
      }
    },
    [audio],
  )

  // kind: 'record' (count-in, then your hits are captured), 'play' (your drums with the backing) or
  // 'jam' (only the backing, so you can tap along freely before recording).
  const start = useCallback(
    async (kind) => {
      endSession()
      setError('')
      setNotice('')
      setSaved(null)
      const recording = kind === 'record'
      try {
        const s = live.current
        // The song you are building plays under you, lined up with where its beat starts.
        let song = null
        if (s.backing === 'song') {
          song = await loadSongTimeline()
          if (!song) setNotice('Your song has nothing in it yet, so only the click plays.')
        }
        const bpm = song ? song.timeline.bpm : s.bpm
        const beatSec = 60 / bpm
        let startAt = 0
        if (song) {
          const beatClips = song.timeline.tracks.flatMap((t) => t.clips.filter((c) => c.bars && !c.notes))
          startAt = beatClips.length ? Math.min(...beatClips.map((c) => c.start)) : 0
          backingRef.current = {
            ...song.timeline,
            metronome: false,
            loop: { on: true, start: startAt, end: startAt + s.bars * barSeconds(bpm) },
            // drums you added before are not played again unless you ask for them
            tracks: song.timeline.tracks.map((t) => (t.kind === 'beat' && t.name.startsWith('Drums') && !s.includeDrums ? { ...t, mute: true } : t)),
          }
          setSongBpm(bpm)
          await engine.loadAll(backingRef.current)
        }
        await unlockAudio()
        const { ctx, input } = audio()
        const lead = recording && s.countIn ? LEAD_BEATS : 0
        const t0 = ctx.currentTime + 0.12 + lead * beatSec
        const gate = ctx.createGain()
        gate.connect(input)
        const total = s.bars * STEPS
        const playsPart = kind === 'play' || (recording && s.hearPart)
        const session = { ctx, t0, beatSec, bpm, bars: s.bars, gate, recording, skip: new Set(), cursor: -lead * 4, timer: 0, mode: lead ? 'counting' : recording ? 'recording' : kind === 'jam' ? 'jamming' : 'playing' }
        sessionRef.current = session
        if (recording) pushHistory()
        if (song) (await engine.ensureEngine()).player.play(startAt, t0)
        setMode(session.mode)

        const tick = () => {
          const now = ctx.currentTime
          const limit = ((now + 0.12 - t0) / beatSec) * 4 // in steps
          for (let n = Math.ceil(session.cursor); n < limit; n++) {
            const time = t0 + (n * beatSec) / 4
            const late = n >= 0 ? swingDelay(n, bpm, live.current.swing) : 0
            if (n % 4 === 0 && (n < 0 || live.current.click)) playClick(ctx, gate, time, mod(n, 16) === 0)
            if (n < 0 || !playsPart) continue
            for (const lane of DRUM_LANES) {
              if (hitsRef.current[lane.id][n % total] && !session.skip.has(`${lane.id}:${n}`)) playDrum(ctx, gate, lane.id, time + late)
            }
          }
          if (limit > session.cursor) session.cursor = limit
          const here = ((now - t0) / beatSec) * 4
          if (session.mode === 'counting' && here >= 0) {
            session.mode = 'recording'
            setMode('recording')
          }
          setPosition(here < 0 ? here / 4 : mod(here, total))
          if (session.skip.size > 64) session.skip.clear()
        }
        session.timer = window.setInterval(tick, 25)
        tick()
      } catch (e) {
        endSession()
        setError(e.message || 'Could not start audio.')
      }
    },
    [audio, endSession, engine, pushHistory],
  )

  const record = useCallback(() => start('record'), [start])
  const play = useCallback(() => start('play'), [start])
  const jam = useCallback(() => start('jam'), [start])

  const toggleStep = useCallback(
    (laneId, step) => {
      pushHistory()
      setHits((h) => toggleHit(h, laneId, step))
      setSaved(null)
    },
    [pushHistory],
  )

  const clear = useCallback(() => {
    if (!hasHits(hitsRef.current)) return
    pushHistory()
    setHits(emptyHits(live.current.bars))
    setSaved(null)
  }, [pushHistory])

  const clearLane = useCallback(
    (laneId) => {
      if (!hitsRef.current[laneId]?.some(Boolean)) return
      pushHistory()
      setHits((h) => ({ ...h, [laneId]: h[laneId].map(() => false) }))
      setSaved(null)
    },
    [pushHistory],
  )

  // Copies the first bar into every other bar, so a bar you like becomes the whole loop.
  const repeatFirstBar = useCallback(() => {
    const n = live.current.bars
    if (n < 2) return
    pushHistory()
    setHits((h) => Object.fromEntries(Object.entries(h).map(([id, row]) => [id, row.map((_, i) => row[i % STEPS])])))
    setSaved(null)
  }, [pushHistory])

  const setSwing = useCallback((v) => setSwingState(Math.min(1, Math.max(0, Number(v) || 0))), [])

  const undo = useCallback(() => {
    const previous = historyRef.current.pop()
    if (!previous) return
    setHits(previous)
    setCanUndo(historyRef.current.length > 0)
  }, [])

  const setBars = useCallback(
    (n) => {
      const next = Math.min(MAX_DRUM_BARS, Math.max(1, Math.round(Number(n) || 1)))
      endSession()
      setBarsState(next)
      setHits((h) => normalizeHits(h, next))
    },
    [endSession],
  )

  const setBpm = useCallback((v) => setBpmState(clampBpm(v)), [])

  const saveToSong = useCallback(async () => {
    if (!hasHits(hitsRef.current)) {
      setError('Record or tap some drums first.')
      return
    }
    endSession()
    setSaving(true)
    setError('')
    try {
      const pattern = hitsToPattern(hitsRef.current, bars, { bpm, swing })
      const result = await addDrumPartToSong({ name: partName, bars, pattern })
      setSong(result.project)
      setSaved({ songName: result.project.name })
    } catch (e) {
      setError(e.message || 'Could not save to your song.')
    } finally {
      setSaving(false)
    }
  }, [bars, bpm, swing, endSession, partName])

  useEffect(() => endSession, [endSession])

  return { backing, setBacking, hearPart, setHearPart, includeDrums, setIncludeDrums, songBpm, notice, jam, swing, setSwing, clearLane, repeatFirstBar, bars, setBars, bpm, setBpm, hits, click, setClick, countIn, setCountIn, partName, setPartName, mode, position, flash, song, saved, saving, error, canUndo, hit, record, play, stop, toggleStep, clear, undo, saveToSong }
}
