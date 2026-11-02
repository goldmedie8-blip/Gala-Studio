import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAudioContext, unlockAudio } from '../../engine/audioContext.js'
import { playClick } from '../../engine/metronome.js'
import { BEATS_PER_BAR, NoteRecorder, getGrid, normalizeNotes, quantizeNotes, scheduleClipNotes } from '../../engine/notes.js'
import { MAX_BPM, MIN_BPM, arrangementLength } from '../../engine/pattern.js'
import { createMaster, playStep } from '../../engine/playback.js'
import { chordNotes, clampNote, createVoice, playNote } from '../../engine/piano.js'
import { SCALES } from '../../engine/scale.js'
import { Sequencer } from '../../engine/sequencer.js'
import { loadBeat } from '../../storage/beatStore.js'
import { addPianoPartToSong, currentSong } from '../../storage/songParts.js'
import { PRESETS } from '../beats/presets.js'

const DRAFT_KEY = 'gala.piano.v1'
const LEAD_BEATS = 4 // one bar of count-in
const MAX_BARS = 16
const HISTORY_LIMIT = 20

const clampBpm = (v) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(Number(v) || 100)))
const mod = (n, m) => ((n % m) + m) % m

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (d && typeof d === 'object') return d
  } catch {
    // unreadable draft
  }
  return {}
}

// The nearest note that is in the key, so a "snap to key" press can never sound wrong.
export function snapToKey(midi, key, scale) {
  const steps = SCALES[scale]?.steps ?? SCALES.major.steps
  const inKey = (m) => steps.includes(mod(m - key, 12))
  for (let d = 0; d < 12; d++) {
    if (inKey(midi + d)) return midi + d
    if (inKey(midi - d)) return midi - d
  }
  return midi
}
export const isInKey = (midi, key, scale) => (SCALES[scale]?.steps ?? []).includes(mod(midi - key, 12))

// Everything the Piano tool does: live playing, recording over the song's beat, playing the part back,
// editing it and saving it into the song. The screen only draws it.
export function usePiano() {
  const draft = useMemo(loadDraft, [])
  const [sound, setSound] = useState(draft.sound ?? 'piano')
  const [octave, setOctave] = useState(3)
  const [chord, setChord] = useState('single')
  const [keyRoot, setKeyRoot] = useState(draft.keyRoot ?? 0)
  const [scale, setScale] = useState(draft.scale ?? 'natural-minor')
  const [showKey, setShowKey] = useState(false)
  const [snap, setSnap] = useState(false)
  const [beat, setBeat] = useState(() => loadBeat() ?? PRESETS[0].pattern)
  const [bpm, setBpmState] = useState(draft.bpm ?? beat.bpm)
  const [bars, setBarsState] = useState(draft.bars ?? 2)
  const [quantizeId, setQuantizeId] = useState(draft.quantizeId ?? '16')
  const [withBeat, setWithBeat] = useState(true)
  const [metronome, setMetronome] = useState(false)
  const [countIn, setCountIn] = useState(true)
  const [notes, setNotes] = useState(() => normalizeNotes(draft.notes, draft.bars ?? 2))
  const [partName, setPartName] = useState(draft.partName ?? 'Piano idea')
  const [mode, setMode] = useState('idle') // idle | counting | recording | playing
  const [position, setPosition] = useState(0) // beats into the part; negative while counting in
  const [held, setHeld] = useState(() => new Set())
  const [song, setSong] = useState(null)
  const [saved, setSaved] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [canUndo, setCanUndo] = useState(false)

  const ref = useRef({})
  const live = useRef(new Map()) // midi -> { voices, key }
  const sessionRef = useRef(null)
  const historyRef = useRef([])
  const masterRef = useRef(null)
  const state = useRef({})
  state.current = { sound, chord, keyRoot, scale, snap, notes, bars, bpm, beat, withBeat, metronome, countIn, quantizeId }
  ref.current.notes = notes

  // The song you are working on gives its beat and tempo.
  useEffect(() => {
    let alive = true
    currentSong()
      .then((project) => {
        if (!alive || !project) return
        setSong(project)
        if (project.beat) {
          setBeat(project.beat)
          if (!draft.bpm) setBpmState(project.beat.bpm)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [draft.bpm])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ sound, keyRoot, scale, bpm, bars, quantizeId, notes, partName }))
    } catch {
      // not remembered
    }
  }, [sound, keyRoot, scale, bpm, bars, quantizeId, notes, partName])

  const audio = useCallback(() => {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') unlockAudio().catch(() => {})
    if (masterRef.current?.ctx !== ctx) {
      const master = createMaster(ctx)
      const liveBus = ctx.createGain()
      liveBus.gain.value = 0.9
      liveBus.connect(master.input)
      masterRef.current = { ctx, master, liveBus }
    }
    return masterRef.current
  }, [])

  // ---- playing keys ---------------------------------------------------------------------------------
  const noteDown = useCallback(
    (midi, velocity = 0.8) => {
      const s = state.current
      let root = clampNote(midi)
      if (s.snap) root = clampNote(snapToKey(root, s.keyRoot, s.scale))
      if (live.current.has(midi)) return
      const { ctx, liveBus } = audio()
      const list = chordNotes(root, s.chord)
      const voices = list.map((m) => createVoice(ctx, liveBus, m, ctx.currentTime, { velocity, sound: s.sound }))
      live.current.set(midi, { voices, notes: list })
      setHeld((h) => new Set(h).add(midi))
      const session = sessionRef.current
      if (session?.recorder && session.mode === 'recording') {
        const at = mod((ctx.currentTime - session.t0) / session.beatSec, session.total)
        if (ctx.currentTime >= session.t0) for (const m of list) session.recorder.down(m, at, velocity)
      }
    },
    [audio],
  )

  const noteUp = useCallback(
    (midi) => {
      const entry = live.current.get(midi)
      if (!entry) return
      live.current.delete(midi)
      const { ctx } = audio()
      for (const v of entry.voices) v.release(ctx.currentTime)
      setHeld((h) => {
        const next = new Set(h)
        next.delete(midi)
        return next
      })
      const session = sessionRef.current
      if (session?.recorder && session.mode === 'recording') {
        const at = mod((ctx.currentTime - session.t0) / session.beatSec, session.total)
        for (const m of entry.notes) session.recorder.up(m, at)
      }
    },
    [audio],
  )

  const releaseAll = useCallback(() => {
    for (const midi of [...live.current.keys()]) noteUp(midi)
  }, [noteUp])

  // ---- recording and playing the part ---------------------------------------------------------------
  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), ref.current.notes]
    setCanUndo(true)
  }, [])

  const endSession = useCallback(
    (commit) => {
      const session = sessionRef.current
      sessionRef.current = null
      if (!session) return
      window.clearInterval(session.timer)
      session.sequencer?.stop()
      session.gate.gain.setValueAtTime(0, session.ctx.currentTime)
      session.gate.disconnect()
      session.beatBus.disconnect()
      if (commit && session.recorder) {
        const at = mod((session.ctx.currentTime - session.t0) / session.beatSec, session.total)
        const recorded = session.recorder.finish(at)
        if (recorded.length > 0) {
          const grid = getGrid(state.current.quantizeId)
          const added = quantizeNotes(recorded, grid, session.bars)
          pushHistory()
          setNotes((current) => normalizeNotes([...current, ...added], session.bars))
          setSaved(null)
        }
      }
      setMode('idle')
      setPosition(0)
    },
    [pushHistory],
  )

  const stop = useCallback(() => {
    endSession(true)
  }, [endSession])

  const start = useCallback(
    async (recording) => {
      endSession(false)
      setError('')
      setSaved(null)
      try {
        await unlockAudio()
        const { ctx, master } = audio()
        const s = state.current
        const beatSec = 60 / s.bpm
        const lead = recording && s.countIn ? LEAD_BEATS : 0
        const t0 = ctx.currentTime + 0.12 + lead * beatSec
        const gate = ctx.createGain()
        gate.connect(master.input)
        const beatBus = ctx.createGain()
        beatBus.gain.value = 0.55
        beatBus.connect(master.input)
        const pattern = { ...s.beat, bpm: s.bpm }
        const sequencer = s.withBeat
          ? new Sequencer({
              getTime: () => ctx.currentTime,
              getBpm: () => state.current.bpm,
              getSwing: () => state.current.beat.swing,
              getLength: () => arrangementLength(state.current.beat),
              play: (step, time) => playStep(ctx, beatBus, { ...state.current.beat, bpm: state.current.bpm }, step, time),
            })
          : null
        void pattern
        const session = {
          ctx, t0, beatSec, bars: s.bars, total: s.bars * BEATS_PER_BAR, mode: lead ? 'counting' : recording ? 'recording' : 'playing',
          recorder: recording ? new NoteRecorder(s.bars) : null, gate, beatBus, sequencer, cursor: -lead, timer: 0,
        }
        sessionRef.current = session
        sequencer?.start(t0)
        setMode(session.mode)

        const tick = () => {
          const now = ctx.currentTime
          const limit = (now + 0.12 - t0) / beatSec
          // clicks: always during the count-in, then only if the metronome is on
          for (let k = Math.ceil(session.cursor); k < limit; k++) {
            if (k < 0 || state.current.metronome) playClick(ctx, gate, t0 + k * beatSec, mod(k, 4) === 0)
          }
          // the notes already in the part, looping
          const a = Math.max(0, session.cursor) * beatSec
          const b = limit * beatSec
          if (b > a) {
            const clip = { start: 0, bars: 100000, loopBars: session.bars, shift: 0, notes: ref.current.notes }
            for (const e of scheduleClipNotes(clip, 60 / state.current.bpm, a, b)) {
              playNote(ctx, gate, e.midi, t0 + e.time, { duration: e.seconds, velocity: e.velocity, sound: state.current.sound })
            }
          }
          if (limit > session.cursor) session.cursor = limit
          const here = (now - t0) / beatSec
          if (session.mode === 'counting' && here >= 0) {
            session.mode = recording ? 'recording' : 'playing'
            setMode(session.mode)
          }
          setPosition(here < 0 ? here : mod(here, session.total))
        }
        session.timer = window.setInterval(tick, 25)
        tick()
      } catch (e) {
        endSession(false)
        setError(e.message || 'Could not start audio.')
      }
    },
    [audio, endSession],
  )

  const record = useCallback(() => start(true), [start])
  const play = useCallback(() => start(false), [start])

  // ---- editing the part -----------------------------------------------------------------------------
  const clear = useCallback(() => {
    if (ref.current.notes.length === 0) return
    pushHistory()
    setNotes([])
    setSaved(null)
  }, [pushHistory])

  const undo = useCallback(() => {
    const previous = historyRef.current.pop()
    if (!previous) return
    setNotes(previous)
    setCanUndo(historyRef.current.length > 0)
    setSaved(null)
  }, [])

  const removeNote = useCallback(
    (index) => {
      pushHistory()
      setNotes((list) => list.filter((_, i) => i !== index))
      setSaved(null)
    },
    [pushHistory],
  )

  const tidyUp = useCallback(() => {
    const grid = getGrid(state.current.quantizeId)
    if (!grid) return
    pushHistory()
    setNotes((list) => normalizeNotes(quantizeNotes(list, grid, state.current.bars), state.current.bars))
  }, [pushHistory])

  const setBars = useCallback(
    (n) => {
      const bars = Math.min(MAX_BARS, Math.max(1, Math.round(Number(n) || 1)))
      endSession(false)
      setBarsState(bars)
      setNotes((list) => normalizeNotes(list, bars))
    },
    [endSession],
  )

  const setBpm = useCallback((v) => setBpmState(clampBpm(v)), [])
  const shiftOctave = useCallback((d) => setOctave((o) => Math.min(6, Math.max(1, o + d))), [])

  const saveToSong = useCallback(async () => {
    if (ref.current.notes.length === 0) {
      setError('Record or play something first.')
      return
    }
    endSession(false)
    setSaving(true)
    setError('')
    try {
      const result = await addPianoPartToSong({ name: partName, bars, notes: ref.current.notes, sound })
      setSong(result.project)
      setSaved({ songName: result.project.name })
    } catch (e) {
      setError(e.message || 'Could not save to your song.')
    } finally {
      setSaving(false)
    }
  }, [bars, endSession, partName, sound])

  useEffect(
    () => () => {
      endSession(false)
      for (const entry of live.current.values()) for (const v of entry.voices) v.release()
      live.current.clear()
    },
    [endSession],
  )

  return {
    sound, setSound, octave, shiftOctave, chord, setChord, keyRoot, setKeyRoot, scale, setScale, showKey, setShowKey, snap, setSnap,
    bpm, setBpm, bars, setBars, quantizeId, setQuantizeId, withBeat, setWithBeat, metronome, setMetronome, countIn, setCountIn,
    notes, partName, setPartName, mode, position, held, song, saved, saving, error, canUndo,
    noteDown, noteUp, releaseAll, record, play, stop, clear, undo, removeNote, tidyUp, saveToSong, beat,
    base: 12 * (octave + 1),
  }
}
