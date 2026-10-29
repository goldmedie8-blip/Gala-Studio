import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAudioContext, unlockAudio } from '../../engine/audioContext.js'
import { clampOffset, decodeAudioBlob, peaksFromBuffer, planStart, renderMix } from '../../engine/mix.js'
import { MAX_BPM, MIN_BPM, normalizePattern } from '../../engine/pattern.js'
import { createMaster, playStep } from '../../engine/playback.js'
import { Sequencer } from '../../engine/sequencer.js'
import { bpmFromTaps } from '../../engine/tempo.js'
import { loadBeat, saveBeat } from '../../storage/beatStore.js'
import { snapshotFields } from '../../storage/projects.js'
import { listTakes, saveTake } from '../../storage/takes.js'
import { PRESETS, getPreset } from '../beats/presets.js'

const RESTART_DELAY_MS = 300

// Everything the Studio tool does: pick a recorded voice, loop the shared beat under it, line the two
// up (tap tempo, beat start), balance the volumes and export the result. The panel only draws it.
export function useVoiceBeat({ initialProject } = {}) {
  const [takes, setTakes] = useState([])
  const [takesLoaded, setTakesLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState(initialProject?.takeId ?? '')
  const [voice, setVoice] = useState(null) // { buffer, peaks }
  const [loadingVoice, setLoadingVoice] = useState(false)
  const [pattern, setPattern] = useState(() => loadBeat() ?? initialProject?.beat ?? PRESETS[0].pattern)
  const [offset, setOffsetState] = useState(initialProject?.offset ?? 0)
  const [voiceVolume, setVoiceVolume] = useState(initialProject?.voiceVolume ?? 1)
  const [beatVolume, setBeatVolume] = useState(initialProject?.beatVolume ?? 0.6)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const voiceRef = useRef(null)
  voiceRef.current = voice
  const patternRef = useRef(pattern)
  patternRef.current = pattern
  const offsetRef = useRef(initialProject?.offset ?? 0)
  const voiceVolRef = useRef(initialProject?.voiceVolume ?? 1)
  const beatVolRef = useRef(initialProject?.beatVolume ?? 0.6)
  const sessionRef = useRef(null)
  const masterRef = useRef(null)
  const progressRef = useRef(0)
  const restartRef = useRef(0)
  const tokenRef = useRef(0)
  const tapsRef = useRef([])
  const playRef = useRef(null)

  // The shared beat is remembered, so the Beats tool shows the same one.
  useEffect(() => saveBeat(pattern), [pattern])

  useEffect(() => {
    let alive = true
    listTakes()
      .then((rows) => {
        if (!alive) return
        setTakes(rows)
        setSelectedId((current) => current || rows[0]?.id || '')
      })
      .catch(() => {})
      .finally(() => alive && setTakesLoaded(true))
    return () => {
      alive = false
    }
  }, [])

  const selectedTake = useMemo(() => takes.find((t) => t.id === selectedId), [takes, selectedId])

  // Everything about the song that Studio edits. The song card compares this to know when to save.
  const snapshot = useMemo(() => {
    const remembered = selectedId && selectedId === initialProject?.takeId ? initialProject : null
    return snapshotFields({
      takeId: selectedId,
      takeName: selectedTake?.name ?? remembered?.takeName ?? '',
      takeDurationMs: selectedTake?.durationMs ?? remembered?.takeDurationMs ?? 0,
      beat: pattern,
      offset,
      voiceVolume,
      beatVolume,
    })
  }, [selectedId, selectedTake, initialProject, pattern, offset, voiceVolume, beatVolume])

  // A take recorded over a beat remembers that beat's tempo. Choosing it puts the tempo back so the
  // beat and the voice are still lined up.
  // An opened song already has its own tempo, so its recording must not overwrite it on the way in.
  const skipMetaRef = useRef(Boolean(initialProject))
  useEffect(() => {
    if (skipMetaRef.current) {
      if (selectedTake) skipMetaRef.current = false
      return
    }
    const meta = selectedTake?.meta
    if (meta?.bpm) setPattern((p) => normalizePattern({ ...p, bpm: meta.bpm, swing: meta.swing ?? p.swing }))
  }, [selectedTake])

  useEffect(() => {
    if (!selectedTake) {
      setVoice(null)
      return undefined
    }
    let alive = true
    setLoadingVoice(true)
    setError('')
    decodeAudioBlob(getAudioContext(), selectedTake.blob)
      .then((buffer) => alive && setVoice({ buffer, peaks: peaksFromBuffer(buffer) }))
      .catch(() => {
        if (!alive) return
        setVoice(null)
        setError('That recording could not be opened.')
      })
      .finally(() => alive && setLoadingVoice(false))
    return () => {
      alive = false
    }
  }, [selectedTake])

  const teardown = useCallback(() => {
    tokenRef.current += 1
    window.clearInterval(progressRef.current)
    window.clearTimeout(restartRef.current)
    const session = sessionRef.current
    sessionRef.current = null
    if (!session) return
    session.source.onended = null
    try {
      session.source.stop()
    } catch {
      // already stopped
    }
    session.sequencer.stop()
    session.voiceBus.disconnect()
    session.beatBus.disconnect()
  }, [])

  const stop = useCallback(() => {
    teardown()
    setPlaying(false)
    setPosition(0)
  }, [teardown])

  const play = useCallback(async () => {
    const buffer = voiceRef.current?.buffer
    if (!buffer) return
    teardown()
    const token = tokenRef.current
    setError('')
    try {
      const ctx = await unlockAudio()
      if (token !== tokenRef.current) return // stopped or restarted while audio was waking up
      if (masterRef.current?.ctx !== ctx) masterRef.current = createMaster(ctx)
      const master = masterRef.current

      const { voiceDelay, beatDelay } = planStart(offsetRef.current)
      const t0 = ctx.currentTime + 0.1

      const voiceBus = ctx.createGain()
      voiceBus.gain.value = voiceVolRef.current
      voiceBus.connect(master.input)
      const beatBus = ctx.createGain()
      beatBus.gain.value = beatVolRef.current
      beatBus.connect(master.input)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(voiceBus)

      const sequencer = new Sequencer({
        getTime: () => ctx.currentTime,
        getBpm: () => patternRef.current.bpm,
        getSwing: () => patternRef.current.swing,
        play: (step, time) => playStep(ctx, beatBus, patternRef.current, step, time),
      })

      const session = { source, sequencer, voiceBus, beatBus }
      sessionRef.current = session
      source.onended = () => {
        if (sessionRef.current === session) stop()
      }
      source.start(t0 + voiceDelay)
      sequencer.start(t0 + beatDelay)

      progressRef.current = window.setInterval(() => setPosition(Math.max(0, ctx.currentTime - t0)), 100)
      setPlaying(true)
    } catch (e) {
      teardown()
      setError(e.message || 'Could not start audio.')
    }
  }, [teardown, stop])
  playRef.current = play

  const selectTake = useCallback(
    (id) => {
      stop()
      skipMetaRef.current = false
      setSelectedId(id)
      setOffsetState(0)
      offsetRef.current = 0
    },
    [stop],
  )

  const setOffset = useCallback((value) => {
    const next = clampOffset(value)
    setOffsetState(next)
    offsetRef.current = next
    // While it is playing, restart shortly after the last nudge so the new alignment can be heard.
    if (sessionRef.current) {
      window.clearTimeout(restartRef.current)
      restartRef.current = window.setTimeout(() => playRef.current?.(), RESTART_DELAY_MS)
    }
  }, [])

  const nudgeOffset = useCallback((delta) => setOffset(offsetRef.current + delta), [setOffset])

  // A take that was just recorded in Studio: add it to the list and select it, lined up from zero.
  const addTake = useCallback(
    (take) => {
      setTakes((list) => [take, ...list])
      selectTake(take.id)
    },
    [selectTake],
  )

  const setField = useCallback((field, value) => {
    setPattern((p) => normalizePattern({ ...p, [field]: value }))
  }, [])

  const nudgeTempo = useCallback((delta) => {
    setPattern((p) => normalizePattern({ ...p, bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, p.bpm + delta)) }))
  }, [])

  const scaleTempo = useCallback((factor) => {
    setPattern((p) => normalizePattern({ ...p, bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(p.bpm * factor))) }))
  }, [])

  const tap = useCallback(() => {
    tapsRef.current = [...tapsRef.current, performance.now()].slice(-8)
    const bpm = bpmFromTaps(tapsRef.current)
    if (bpm) setField('bpm', bpm)
  }, [setField])

  const applyPreset = useCallback((id) => {
    const found = getPreset(id)
    if (found) setPattern(found.pattern)
  }, [])

  const changeVoiceVolume = useCallback((value) => {
    const v = Math.min(2, Math.max(0, Number(value) || 0))
    voiceVolRef.current = v
    setVoiceVolume(v)
    if (sessionRef.current) sessionRef.current.voiceBus.gain.value = v
  }, [])

  const changeBeatVolume = useCallback((value) => {
    const v = Math.min(2, Math.max(0, Number(value) || 0))
    beatVolRef.current = v
    setBeatVolume(v)
    if (sessionRef.current) sessionRef.current.beatBus.gain.value = v
  }, [])

  const addFile = useCallback(
    async (file) => {
      if (!file) return
      setError('')
      let buffer
      try {
        buffer = await decodeAudioBlob(getAudioContext(), file)
      } catch {
        setError('That file could not be opened as audio. Try an MP3, WAV or M4A file.')
        return
      }
      try {
        const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Imported audio'
        const saved = await saveTake({
          blob: file,
          mimeType: file.type || 'audio/mpeg',
          durationMs: Math.round(buffer.duration * 1000),
          name,
        })
        setTakes((list) => [saved, ...list])
        selectTake(saved.id)
      } catch {
        setError('That file opened, but could not be saved on this device.')
      }
    },
    [selectTake],
  )

  const exportMix = useCallback(async () => {
    const buffer = voiceRef.current?.buffer
    if (!buffer) return
    setError('')
    setExporting(true)
    try {
      const blob = await renderMix({
        voice: buffer,
        pattern: patternRef.current,
        offset: offsetRef.current,
        voiceGain: voiceVolRef.current,
        beatGain: beatVolRef.current,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `gala-song-${patternRef.current.bpm}bpm.wav`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      setError(e.message || 'Could not export the song.')
    } finally {
      setExporting(false)
    }
  }, [])

  useEffect(() => teardown, [teardown])

  return {
    takes,
    takesLoaded,
    selectedId,
    selectedTake,
    snapshot,
    voice,
    loadingVoice,
    pattern,
    offset,
    voiceVolume,
    beatVolume,
    playing,
    position,
    exporting,
    error,
    play,
    stop,
    selectTake,
    setOffset,
    nudgeOffset,
    setField,
    nudgeTempo,
    scaleTempo,
    tap,
    applyPreset,
    changeVoiceVolume,
    changeBeatVolume,
    addFile,
    addTake,
    exportMix,
  }
}
