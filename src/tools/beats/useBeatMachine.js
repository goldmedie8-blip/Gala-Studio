import { useCallback, useEffect, useRef, useState } from 'react'
import { unlockAudio } from '../../engine/audioContext.js'
import {
  MAX_BPM,
  MIN_BPM,
  addBar,
  arrangementLength,
  clearPattern,
  copySection,
  locateStep,
  loopSection,
  normalizePattern,
  removeBar,
  setBarSection,
  setNoteStep,
  switchSection,
  toggleDrum,
} from '../../engine/pattern.js'
import { createMaster, playDrum, playNote, playStep } from '../../engine/playback.js'
import { renderBeat } from '../../engine/render.js'
import { Sequencer } from '../../engine/sequencer.js'
import { getPreset, PRESETS } from './presets.js'

const STORAGE_KEY = 'gala.beat.v1'

function loadPattern() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return normalizePattern(JSON.parse(saved))
  } catch {
    // unreadable save, start fresh
  }
  return PRESETS[0].pattern
}

// Everything the Beats tool does: edit the pattern, play it on the audio clock, preview sounds,
// remember the work on the device and export it to a WAV file. The panel only draws the result.
export function useBeatMachine() {
  const [pattern, setPattern] = useState(loadPattern)
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState(-1)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  // 'section' loops the section being edited; 'song' plays the whole arrangement bar by bar.
  const [playMode, setPlayMode] = useState('section')

  const patternRef = useRef(pattern)
  patternRef.current = pattern
  const modeRef = useRef(playMode)
  modeRef.current = playMode
  // What is actually heard: the arrangement, or just the open section.
  const heard = useCallback(
    () => (modeRef.current === 'song' ? patternRef.current : loopSection(patternRef.current)),
    [],
  )
  const playingRef = useRef(false)
  const sequencerRef = useRef(null)
  const masterRef = useRef(null)
  const timeoutsRef = useRef(new Set())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pattern))
    } catch {
      // storage full or blocked: the beat still plays, it just will not be remembered
    }
  }, [pattern])

  const getAudio = useCallback(async () => {
    const ctx = await unlockAudio()
    if (masterRef.current?.ctx !== ctx) masterRef.current = createMaster(ctx)
    return { ctx, dest: masterRef.current.input }
  }, [])

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((id) => clearTimeout(id))
    timeoutsRef.current.clear()
  }, [])

  const stop = useCallback(() => {
    sequencerRef.current?.stop()
    sequencerRef.current = null
    clearTimers()
    playingRef.current = false
    setPlaying(false)
    setStep(-1)
  }, [clearTimers])

  const play = useCallback(async () => {
    setError('')
    try {
      const { ctx, dest } = await getAudio()
      const sequencer = new Sequencer({
        getTime: () => ctx.currentTime,
        getBpm: () => patternRef.current.bpm,
        getSwing: () => patternRef.current.swing,
        getLength: () => arrangementLength(heard()),
        play: (s, time) => playStep(ctx, dest, heard(), s, time),
        // Highlight the step at the moment it is heard, not when it was scheduled.
        onStep: (s, time) => {
          const id = setTimeout(() => {
            timeoutsRef.current.delete(id)
            setStep(s)
          }, Math.max(0, (time - ctx.currentTime) * 1000))
          timeoutsRef.current.add(id)
        },
      })
      sequencerRef.current = sequencer
      sequencer.start()
      playingRef.current = true
      setPlaying(true)
    } catch (e) {
      setError(e.message || 'Could not start audio.')
    }
  }, [getAudio, heard])

  const preview = useCallback(
    async (action) => {
      try {
        const { ctx, dest } = await getAudio()
        action(ctx, dest, ctx.currentTime + 0.01)
      } catch {
        // previews are a nicety, never an error
      }
    },
    [getAudio],
  )

  const previewDrum = useCallback((laneId) => preview((ctx, dest, t) => playDrum(ctx, dest, laneId, t)), [preview])

  const previewNote = useCallback(
    (degree, track = 'melody') => preview((ctx, dest, t) => playNote(ctx, dest, patternRef.current, degree, t, 0.35, track)),
    [preview],
  )

  const toggleStep = useCallback(
    (laneId, index) => {
      const turningOn = !patternRef.current.drums[laneId][index]
      setPattern((p) => toggleDrum(p, laneId, index))
      if (turningOn && !playingRef.current) previewDrum(laneId)
    },
    [previewDrum],
  )

  // `track` is 'melody' or 'bass'.
  const toggleNote = useCallback(
    (index, degree, track = 'melody') => {
      const turningOn = patternRef.current[track][index] !== degree
      setPattern((p) => setNoteStep(p, track, index, degree))
      if (turningOn && !playingRef.current) previewNote(degree, track)
    },
    [previewNote],
  )

  const selectSection = useCallback((index) => setPattern((p) => switchSection(p, index)), [])
  const copyFromSection = useCallback((index) => setPattern((p) => copySection(p, index)), [])
  const setBar = useCallback((bar, index) => setPattern((p) => setBarSection(p, bar, index)), [])
  const addBarToSong = useCallback(() => setPattern((p) => addBar(p)), [])
  const removeLastBar = useCallback(() => setPattern((p) => removeBar(p)), [])

  const setField = useCallback((field, value) => {
    setPattern((p) => normalizePattern({ ...p, [field]: value }))
  }, [])

  const applyPreset = useCallback((id) => {
    const found = getPreset(id)
    if (found) setPattern(found.pattern)
  }, [])

  const clear = useCallback(() => setPattern((p) => clearPattern(p)), [])

  const nudgeTempo = useCallback((delta) => {
    setPattern((p) => normalizePattern({ ...p, bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, p.bpm + delta)) }))
  }, [])

  const exportWav = useCallback(async () => {
    setError('')
    setExporting(true)
    try {
      const blob =
        modeRef.current === 'song'
          ? await renderBeat(patternRef.current)
          : await renderBeat(loopSection(patternRef.current), { bars: 4 })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `gala-beat-${patternRef.current.bpm}bpm.wav`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      setError(e.message || 'Could not export the beat.')
    } finally {
      setExporting(false)
    }
  }, [])

  useEffect(
    () => () => {
      sequencerRef.current?.stop()
      timeoutsRef.current.forEach((id) => clearTimeout(id))
    },
    [],
  )

  // Where the playing beat is: which bar, which step in it and which section is sounding.
  const playhead = playing && step >= 0 ? locateStep(heard(), step) : null

  return {
    pattern,
    playing,
    step,
    playhead,
    playMode,
    setPlayMode,
    selectSection,
    copyFromSection,
    setBar,
    addBar: addBarToSong,
    removeBar: removeLastBar,
    exporting,
    error,
    play,
    stop,
    toggleStep,
    toggleNote,
    previewDrum,
    setField,
    applyPreset,
    clear,
    nudgeTempo,
    exportWav,
  }
}
