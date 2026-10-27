import { useCallback, useEffect, useRef, useState } from 'react'
import { unlockAudio } from '../../engine/audioContext.js'
import { MAX_BPM, MIN_BPM, clearPattern, normalizePattern, setMelodyStep, toggleDrum } from '../../engine/pattern.js'
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

  const patternRef = useRef(pattern)
  patternRef.current = pattern
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
        play: (s, time) => playStep(ctx, dest, patternRef.current, s, time),
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
  }, [getAudio])

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
    (degree, source = patternRef.current) =>
      preview((ctx, dest, t) => playNote(ctx, dest, source, degree, t, 0.35)),
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

  const toggleNote = useCallback(
    (index, degree) => {
      const turningOn = patternRef.current.melody[index] !== degree
      setPattern((p) => setMelodyStep(p, index, degree))
      if (turningOn && !playingRef.current) previewNote(degree)
    },
    [previewNote],
  )

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
      const blob = await renderBeat(patternRef.current, { bars: 4 })
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

  return {
    pattern,
    playing,
    step,
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
