import { useCallback, useEffect, useRef, useState } from 'react'
import { unlockAudio } from '../../engine/audioContext.js'
import { levelFromTimeDomain } from '../../engine/level.js'
import { createRecorder, friendlyMicError, listInputs, openInput } from '../../engine/recorder.js'
import { deleteTake, listTakes, nextTakeName, requestPersistentStorage, saveTake } from '../../storage/takes.js'

const SILENT = { level: 0, clipping: false }

// All the recording logic for the Record tool: mic permission, input choice, live meter,
// recording, and saving takes on the device. The panel only draws what this returns.
export function useRecorder() {
  const [status, setStatus] = useState('idle') // idle | ready | recording
  const [error, setError] = useState('')
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [meter, setMeter] = useState(SILENT)
  const [elapsed, setElapsed] = useState(0)
  const [takes, setTakes] = useState([])

  const streamRef = useRef(null)
  const meterRef = useRef(null)
  const frameRef = useRef(0)
  const lastMeterRef = useRef('')
  const recorderRef = useRef(null)
  const timerRef = useRef(0)
  const takesRef = useRef([])
  takesRef.current = takes

  useEffect(() => {
    let alive = true
    listTakes()
      .then((rows) => alive && setTakes(rows))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    meterRef.current?.source.disconnect()
    meterRef.current = null
    lastMeterRef.current = ''
    setMeter(SILENT)
  }, [])

  const startMeter = useCallback(async (stream) => {
    const ctx = await unlockAudio()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser) // never connected to the speakers, so there is no feedback
    meterRef.current = { source }
    const samples = new Float32Array(analyser.fftSize)

    const tick = () => {
      analyser.getFloatTimeDomainData(samples)
      const { level, clipping } = levelFromTimeDomain(samples)
      const key = `${Math.round(level * 60)}-${clipping}`
      if (key !== lastMeterRef.current) {
        lastMeterRef.current = key
        setMeter({ level, clipping })
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  const closeStream = useCallback(() => {
    stopMeter()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [stopMeter])

  const connect = useCallback(
    async (wantedId) => {
      closeStream()
      const stream = await openInput(wantedId || undefined)
      streamRef.current = stream
      // Labels only appear after permission is granted, so list devices after opening the mic.
      setDevices(await listInputs())
      setDeviceId(stream.getAudioTracks?.()[0]?.getSettings?.().deviceId ?? wantedId ?? '')
      await startMeter(stream)
      setStatus('ready')
    },
    [closeStream, startMeter],
  )

  const enable = useCallback(async () => {
    setError('')
    try {
      await connect('')
      requestPersistentStorage()
    } catch (e) {
      closeStream()
      setError(friendlyMicError(e))
    }
  }, [connect, closeStream])

  const changeDevice = useCallback(
    async (id) => {
      setError('')
      try {
        await connect(id)
      } catch (e) {
        closeStream()
        setStatus('idle')
        setError(friendlyMicError(e))
      }
    },
    [connect, closeStream],
  )

  const start = useCallback(() => {
    setError('')
    try {
      const recorder = createRecorder(streamRef.current)
      recorder.start()
      recorderRef.current = recorder
      const startedAt = performance.now()
      setElapsed(0)
      timerRef.current = window.setInterval(() => setElapsed(performance.now() - startedAt), 200)
      setStatus('recording')
    } catch (e) {
      setError(e.message || 'Could not start recording.')
    }
  }, [])

  const stop = useCallback(async () => {
    window.clearInterval(timerRef.current)
    setElapsed(0)
    setStatus('ready')
    try {
      const result = await recorderRef.current.stop()
      const name = nextTakeName(takesRef.current)
      try {
        const saved = await saveTake({ ...result, name })
        setTakes((list) => [saved, ...list])
      } catch {
        // Keep the take playable for this session even if the device would not store it.
        setTakes((list) => [{ id: `temp-${Date.now()}`, name, createdAt: Date.now(), ...result }, ...list])
        setError('This take could not be saved on the device, so it will disappear when you close the app. Download it now.')
      }
    } catch (e) {
      setError(e.message || 'Recording failed.')
    }
  }, [])

  const removeTake = useCallback(async (id) => {
    setTakes((list) => list.filter((t) => t.id !== id))
    if (!id.startsWith('temp-')) await deleteTake(id).catch(() => {})
  }, [])

  useEffect(
    () => () => {
      window.clearInterval(timerRef.current)
      cancelAnimationFrame(frameRef.current)
      meterRef.current?.source.disconnect()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  return { status, error, devices, deviceId, meter, elapsed, takes, enable, changeDevice, start, stop, removeTake }
}
