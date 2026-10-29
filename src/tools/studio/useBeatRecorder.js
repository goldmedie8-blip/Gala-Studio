import { useCallback, useEffect, useRef, useState } from 'react'
import { unlockAudio } from '../../engine/audioContext.js'
import {
  assembleFrames,
  createCapture,
  estimateLatencySeconds,
  lastFrame,
  monoToWavBlob,
} from '../../engine/capture.js'
import { COUNT_IN_BEATS, scheduleCountIn } from '../../engine/countin.js'
import { levelFromTimeDomain } from '../../engine/level.js'
import { createMaster, playStep } from '../../engine/playback.js'
import { friendlyMicError, listInputs, openInput } from '../../engine/recorder.js'
import { Sequencer } from '../../engine/sequencer.js'
import { requestPersistentStorage, saveTake } from '../../storage/takes.js'

const SYNC_KEY = 'gala.sync.v1'
export const MIN_SYNC_MS = -200
export const MAX_SYNC_MS = 400
const MIN_TAKE_SECONDS = 0.3
const SILENT = { level: 0, clipping: false }

const clampSync = (value) => Math.min(MAX_SYNC_MS, Math.max(MIN_SYNC_MS, Math.round(Number(value) || 0)))

function loadSync() {
  try {
    return clampSync(localStorage.getItem(SYNC_KEY))
  } catch {
    return 0
  }
}

// Recording a voice over the beat. The beat and the count-in play through the speakers or headphones,
// the microphone is captured on the same audio clock, and the take is cut exactly where the beat starts,
// so the voice lines up with the beat without any dragging.
export function useBeatRecorder({ pattern, beatVolume, nextName, onRecorded, beforeStart }) {
  const [status, setStatus] = useState('idle') // idle | ready | counting | recording | saving
  const [error, setError] = useState('')
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [meter, setMeter] = useState(SILENT)
  const [elapsed, setElapsed] = useState(0)
  const [countIn, setCountIn] = useState(true)
  const [syncMs, setSyncState] = useState(loadSync)

  const patternRef = useRef(pattern)
  patternRef.current = pattern
  const beatVolRef = useRef(beatVolume)
  beatVolRef.current = beatVolume
  const nextNameRef = useRef(nextName)
  nextNameRef.current = nextName
  const onRecordedRef = useRef(onRecorded)
  onRecordedRef.current = onRecorded
  const beforeStartRef = useRef(beforeStart)
  beforeStartRef.current = beforeStart
  const countInRef = useRef(true)
  const syncRef = useRef(syncMs)

  const streamRef = useRef(null)
  const micRef = useRef(null)
  const masterRef = useRef(null)
  const sessionRef = useRef(null)
  const meterFrameRef = useRef(0)
  const lastMeterRef = useRef('')
  const tickRef = useRef(0)

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(meterFrameRef.current)
    lastMeterRef.current = ''
    setMeter(SILENT)
  }, [])

  const closeMic = useCallback(() => {
    stopMeter()
    const mic = micRef.current
    micRef.current = null
    mic?.capture.dispose()
    mic?.source.disconnect()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [stopMeter])

  const startMeter = useCallback((analyser) => {
    const samples = new Float32Array(analyser.fftSize)
    const tick = () => {
      analyser.getFloatTimeDomainData(samples)
      const { level, clipping } = levelFromTimeDomain(samples)
      const key = `${Math.round(level * 60)}-${clipping}`
      if (key !== lastMeterRef.current) {
        lastMeterRef.current = key
        setMeter({ level, clipping })
      }
      meterFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  const connect = useCallback(
    async (wantedId) => {
      closeMic()
      const stream = await openInput(wantedId || undefined)
      streamRef.current = stream
      try {
        setDevices(await listInputs()) // names only appear once the microphone is allowed
        const track = stream.getAudioTracks?.()[0]
        setDeviceId(track?.getSettings?.().deviceId ?? wantedId ?? '')
        const ctx = await unlockAudio()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser) // never connected to the speakers, so there is no feedback
        const capture = await createCapture(ctx, source)
        micRef.current = { ctx, source, analyser, capture, track }
        startMeter(analyser)
        setStatus('ready')
      } catch (e) {
        closeMic()
        throw e
      }
    },
    [closeMic, startMeter],
  )

  const fail = useCallback((e) => setError(e?.name === 'UnsupportedError' ? e.message : friendlyMicError(e)), [])

  const enable = useCallback(async () => {
    setError('')
    try {
      await connect('')
      requestPersistentStorage()
    } catch (e) {
      setStatus('idle')
      fail(e)
    }
  }, [connect, fail])

  const changeDevice = useCallback(
    async (id) => {
      setError('')
      try {
        await connect(id)
      } catch (e) {
        setStatus('idle')
        fail(e)
      }
    },
    [connect, fail],
  )

  const releaseSession = useCallback(() => {
    window.clearInterval(tickRef.current)
    const session = sessionRef.current
    sessionRef.current = null
    if (session) {
      session.sequencer.stop()
      session.beatBus.disconnect()
    }
    return session
  }, [])

  const start = useCallback(() => {
    const mic = micRef.current
    if (!mic || sessionRef.current) return
    setError('')
    beforeStartRef.current?.()

    const { ctx } = mic
    // The beat is frozen at the moment recording starts, so the take always matches what was heard.
    const snapshot = patternRef.current
    if (masterRef.current?.ctx !== ctx) masterRef.current = createMaster(ctx)
    const master = masterRef.current

    const beats = countInRef.current ? COUNT_IN_BEATS : 0
    const t0 = ctx.currentTime + 0.15
    const beat0 = t0 + (beats * 60) / snapshot.bpm

    const beatBus = ctx.createGain()
    beatBus.gain.value = beatVolRef.current
    beatBus.connect(master.input)
    if (beats > 0) scheduleCountIn(ctx, master.input, t0, snapshot.bpm, beats)

    const sequencer = new Sequencer({
      getTime: () => ctx.currentTime,
      getBpm: () => snapshot.bpm,
      getSwing: () => snapshot.swing,
      play: (step, time) => playStep(ctx, beatBus, snapshot, step, time),
    })
    sequencer.start(beat0)
    mic.capture.start()

    sessionRef.current = { ctx, beat0, beatBus, sequencer, bpm: snapshot.bpm, swing: snapshot.swing }
    setElapsed(0)
    setStatus('counting')
    tickRef.current = window.setInterval(() => {
      const seconds = ctx.currentTime - beat0
      setElapsed(Math.max(0, seconds) * 1000)
      if (seconds >= 0) setStatus('recording')
    }, 100)
  }, [])

  const stop = useCallback(async () => {
    const mic = micRef.current
    const session = releaseSession()
    if (!session || !mic) return
    setStatus('saving')
    setElapsed(0)
    try {
      const chunks = await mic.capture.stop()
      const sampleRate = session.ctx.sampleRate
      const latency = estimateLatencySeconds(session.ctx, mic.track) + syncRef.current / 1000
      const from = Math.round((session.beat0 + latency) * sampleRate)
      const samples = assembleFrames(chunks, from, lastFrame(chunks))

      if (samples.length < MIN_TAKE_SECONDS * sampleRate) {
        setError('That take was too short. Wait for the count-in to finish, then sing for at least a second.')
        return
      }

      const result = {
        blob: monoToWavBlob(samples, sampleRate),
        mimeType: 'audio/wav',
        durationMs: Math.round((samples.length / sampleRate) * 1000),
        name: nextNameRef.current(),
        meta: { bpm: session.bpm, swing: session.swing, syncMs: syncRef.current },
      }
      let take
      try {
        take = await saveTake(result)
      } catch {
        // Keep the take usable for this session even if the device would not store it.
        take = { ...result, id: `temp-${Date.now()}`, createdAt: Date.now() }
        setError('This take could not be saved on the device, so it will disappear when you close the app.')
      }
      onRecordedRef.current?.(take)
    } catch (e) {
      setError(e?.message || 'Recording failed.')
    } finally {
      setStatus('ready')
    }
  }, [releaseSession])

  const changeCountIn = useCallback((value) => {
    countInRef.current = Boolean(value)
    setCountIn(Boolean(value))
  }, [])

  // If your voice sounds late against the beat, move this up and record again.
  const changeSync = useCallback((value) => {
    const next = clampSync(value)
    syncRef.current = next
    setSyncState(next)
    try {
      localStorage.setItem(SYNC_KEY, String(next))
    } catch {
      // not remembered, still applied
    }
  }, [])

  useEffect(() => {
    if (sessionRef.current) sessionRef.current.beatBus.gain.value = beatVolume
  }, [beatVolume])

  useEffect(
    () => () => {
      releaseSession()
      closeMic()
    },
    [releaseSession, closeMic],
  )

  return {
    status,
    busy: status === 'counting' || status === 'recording' || status === 'saving',
    error,
    devices,
    deviceId,
    meter,
    elapsed,
    countIn,
    syncMs,
    enable,
    changeDevice,
    start,
    stop,
    changeCountIn,
    changeSync,
  }
}
