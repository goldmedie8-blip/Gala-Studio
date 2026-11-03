import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAudioContext, unlockAudio } from '../../engine/audioContext.js'
import { playClick } from '../../engine/metronome.js'
import { BEATS_PER_BAR, NoteRecorder, getGrid, normalizeNotes, quantizeNotes, scheduleClipNotes } from '../../engine/notes.js'
import { MAX_BPM, MIN_BPM, arrangementLength } from '../../engine/pattern.js'
import { createMaster, playStep } from '../../engine/playback.js'
import { chordNotes, clampNote, createVoice, playNote } from '../../engine/piano.js'
import { SCALES } from '../../engine/scale.js'
import { Sequencer } from '../../engine/sequencer.js'
import { barSeconds } from '../../engine/timeline.js'
import { loadBeat } from '../../storage/beatStore.js'
import { addPianoPartToSong, currentSong, loadSongTimeline } from '../../storage/songParts.js'
import { PRESETS } from '../beats/presets.js'
import { useAudioEngine } from '../timeline/useAudioEngine.js'

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
  const [backing, setBacking] = useState(draft.backing ?? 'beat') // what plays under you: beat | song | none
  const [hearPart, setHearPart] = useState(true)
  const [includePiano, setIncludePiano] = useState(false)
  const [songBpm, setSongBpm] = useState(null)
  const [notice, setNotice] = useState('')
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
  const [selected, setSelected] = useState(null) // index of the note being edited

  const backingRef = useRef(null) // the song as it plays under you
  const getBacking = useCallback(() => backingRef.current, [])
  const { api: engine } = useAudioEngine({ getTimeline: getBacking })
  const ref = useRef({})
  const live = useRef(new Map()) // midi -> { voices, key }
  const sessionRef = useRef(null)
  const historyRef = useRef([])
  const masterRef = useRef(null)
  const state = useRef({})
  state.current = { sound, chord, keyRoot, scale, snap, notes, bars, bpm, beat, backing, hearPart, includePiano, metronome, countIn, quantizeId }
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

  // With the whole song as backing, the song's own tempo is used, so show it.
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
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ backing, sound, keyRoot, scale, bpm, bars, quantizeId, notes, partName }))
    } catch {
      // not remembered
    }
  }, [backing, sound, keyRoot, scale, bpm, bars, quantizeId, notes, partName])

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
      engine.engineRef.current?.player.stop()
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
    [pushHistory, engine],
  )

  const stop = useCallback(() => {
    endSession(true)
  }, [endSession])

  // kind: 'record' (count-in, then notes are captured), 'play' (your part with the backing) or
  // 'jam' (only the backing, so you can try ideas on the keys before recording).
  const start = useCallback(
    async (kind) => {
      endSession(false)
      setError('')
      setNotice('')
      setSaved(null)
      const recording = kind === 'record'
      try {
        const s = state.current
        // Whole-song backing: all the tracks of your song loop under you, lined up with the beat.
        let song = null
        if (s.backing === 'song') {
          song = await loadSongTimeline()
          if (!song) setNotice('Your song has nothing in it yet, so the beat plays instead.')
        }
        const bpm = song ? song.timeline.bpm : s.bpm
        const beatSec = 60 / bpm
        const barSec = barSeconds(bpm)
        let startAt = 0
        if (song) {
          const beatClips = song.timeline.tracks.flatMap((t) => t.clips.filter((c) => c.bars && !c.notes))
          startAt = beatClips.length ? Math.min(...beatClips.map((c) => c.start)) : 0
          backingRef.current = {
            ...song.timeline,
            metronome: false,
            loop: { on: true, start: startAt, end: startAt + s.bars * barSec },
            // the piano you are working on is not played again unless you ask for it
            tracks: song.timeline.tracks.map((t) => (t.kind === 'piano' && !s.includePiano ? { ...t, mute: true } : t)),
          }
          setSongBpm(bpm)
          await engine.loadAll(backingRef.current)
        }
        await unlockAudio()
        const { ctx, master } = audio()
        const lead = recording && s.countIn ? LEAD_BEATS : 0
        const t0 = ctx.currentTime + 0.12 + lead * beatSec
        const gate = ctx.createGain()
        gate.connect(master.input)
        const beatBus = ctx.createGain()
        beatBus.gain.value = 0.55
        beatBus.connect(master.input)
        const sequencer =
          !song && s.backing !== 'none'
            ? new Sequencer({
                getTime: () => ctx.currentTime,
                getBpm: () => bpm,
                getSwing: () => state.current.beat.swing,
                getLength: () => arrangementLength(state.current.beat),
                play: (step, time) => playStep(ctx, beatBus, { ...state.current.beat, bpm }, step, time),
              })
            : null
        const playsPart = kind === 'play' || (recording && s.hearPart)
        const session = {
          ctx, t0, beatSec, bpm, bars: s.bars, total: s.bars * BEATS_PER_BAR, mode: lead ? 'counting' : recording ? 'recording' : kind === 'jam' ? 'jamming' : 'playing',
          recorder: recording ? new NoteRecorder(s.bars) : null, gate, beatBus, sequencer, cursor: -lead, timer: 0,
        }
        sessionRef.current = session
        sequencer?.start(t0)
        if (song) {
          const running = await engine.ensureEngine()
          running.player.play(startAt, t0)
        }
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
          if (b > a && playsPart) {
            const clip = { start: 0, bars: 100000, loopBars: session.bars, shift: 0, notes: ref.current.notes }
            for (const e of scheduleClipNotes(clip, bpm, a, b)) {
              playNote(ctx, gate, e.midi, t0 + e.time, { duration: e.seconds, velocity: e.velocity, sound: state.current.sound })
            }
          }
          if (limit > session.cursor) session.cursor = limit
          const here = (now - t0) / beatSec
          if (session.mode === 'counting' && here >= 0) {
            session.mode = 'recording'
            setMode('recording')
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
    [audio, endSession, engine],
  )

  const record = useCallback(() => start('record'), [start])
  const play = useCallback(() => start('play'), [start])
  const jam = useCallback(() => start('jam'), [start])

  // ---- editing the part -----------------------------------------------------------------------------
  const clear = useCallback(() => {
    if (ref.current.notes.length === 0) return
    pushHistory()
    setNotes([])
    setSelected(null)
    setSaved(null)
  }, [pushHistory])

  const undo = useCallback(() => {
    const previous = historyRef.current.pop()
    if (!previous) return
    setNotes(previous)
    setSelected(null)
    setCanUndo(historyRef.current.length > 0)
    setSaved(null)
  }, [])

  const gridBeats = () => getGrid(state.current.quantizeId) || 0.25

  const preview = useCallback(
    (midi) => {
      const { ctx, liveBus } = audio()
      playNote(ctx, liveBus, midi, ctx.currentTime, { duration: 0.35, velocity: 0.7, sound: state.current.sound })
    },
    [audio],
  )

  // Puts a note where you pressed the roll, snapped to the timing grid.
  const addNote = useCallback(
    (midi, beat) => {
      const grid = gridBeats()
      const total = state.current.bars * BEATS_PER_BAR
      const start = Math.min(total - grid, Math.max(0, Math.round(beat / grid) * grid))
      const note = { midi: clampNote(midi), start, length: Math.max(grid, 0.5), velocity: 0.8 }
      pushHistory()
      const next = normalizeNotes([...ref.current.notes, note], state.current.bars)
      setNotes(next)
      setSelected(next.findIndex((n) => n.midi === note.midi && n.start === note.start))
      setSaved(null)
      preview(note.midi)
    },
    [preview, pushHistory],
  )

  const selectNote = useCallback(
    (index) => {
      setSelected((current) => (current === index ? null : index))
      const note = ref.current.notes[index]
      if (note) preview(note.midi)
    },
    [preview],
  )

  // Changes the selected note: { pitch: semitones, time: beats, length: beats }.
  const changeSelected = useCallback(
    ({ pitch = 0, time = 0, length = 0 }) => {
      const note = ref.current.notes[selected]
      if (!note) return
      const total = state.current.bars * BEATS_PER_BAR
      const updated = {
        ...note,
        midi: clampNote(note.midi + pitch),
        start: Math.min(total - 0.0625, Math.max(0, note.start + time)),
        length: Math.max(0.0625, note.length + length),
      }
      pushHistory()
      const next = normalizeNotes(ref.current.notes.map((n, i) => (i === selected ? updated : n)), state.current.bars)
      setNotes(next)
      setSelected(next.findIndex((n) => n.midi === updated.midi && n.start === updated.start))
      setSaved(null)
      if (pitch) preview(updated.midi)
    },
    [preview, pushHistory, selected],
  )

  const deleteSelected = useCallback(() => {
    if (selected === null) return
    pushHistory()
    setNotes((list) => list.filter((_, i) => i !== selected))
    setSelected(null)
    setSaved(null)
  }, [pushHistory, selected])

  // Moves every note up or down. 12 is one octave.
  const transpose = useCallback(
    (semitones) => {
      if (ref.current.notes.length === 0) return
      pushHistory()
      setNotes((list) => normalizeNotes(list.map((n) => ({ ...n, midi: clampNote(n.midi + semitones) })), state.current.bars))
      setSelected(null)
      setSaved(null)
    },
    [pushHistory],
  )

  // Makes the part twice as long, repeating what you have, so a 2-bar idea becomes 4 bars to build on.
  const doublePart = useCallback(() => {
    const bars = state.current.bars
    if (bars * 2 > MAX_BARS) return
    endSession(false)
    pushHistory()
    const shift = bars * BEATS_PER_BAR
    setBarsState(bars * 2)
    setNotes((list) => normalizeNotes([...list, ...list.map((n) => ({ ...n, start: n.start + shift }))], bars * 2))
    setSelected(null)
    setSaved(null)
  }, [endSession, pushHistory])

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
    bpm, setBpm, bars, setBars, quantizeId, setQuantizeId, backing, setBacking, hearPart, setHearPart, includePiano, setIncludePiano, songBpm, notice, jam, metronome, setMetronome, countIn, setCountIn,
    notes, partName, setPartName, mode, position, held, song, saved, saving, error, canUndo,
    selected, addNote, selectNote, changeSelected, deleteSelected, transpose, doublePart,
    noteDown, noteUp, releaseAll, record, play, stop, clear, undo, tidyUp, saveToSong, beat,
    base: 12 * (octave + 1),
  }
}
