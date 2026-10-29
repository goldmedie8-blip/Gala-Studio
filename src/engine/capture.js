// Sample-accurate microphone capture, for recording a voice over a beat.
//
// The browser's MediaRecorder starts a little late by an unpredictable amount, so a take made with it
// never lines up with the beat. Instead we capture raw audio inside the audio engine itself, where every
// block of sound carries the exact frame number on the same clock the beat is scheduled on. Cutting the
// take at the beat's frame makes the voice and the beat line up automatically.
import { encodeWav } from './wav.js'

// Runs inside the audio thread. Sends each block of microphone sound back with its frame number.
export const CAPTURE_WORKLET = `
class GalaCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.recording = false
    this.port.onmessage = (event) => {
      this.recording = event.data === 'start'
      if (event.data === 'stop') this.port.postMessage({ type: 'stopped' })
    }
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (this.recording && channel) {
      const data = new Float32Array(channel)
      this.port.postMessage({ frame: currentFrame, data }, [data.buffer])
    }
    return true
  }
}
registerProcessor('gala-capture', GalaCapture)
`

const loadedModules = new WeakMap()

function loadWorklet(ctx) {
  let loading = loadedModules.get(ctx)
  if (!loading) {
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'application/javascript' }))
    loading = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
    loadedModules.set(ctx, loading)
  }
  return loading
}

export function unsupportedError() {
  const error = new Error('Recording over a beat needs a newer browser. Update Chrome or Safari and try again.')
  error.name = 'UnsupportedError'
  return error
}

// Connects the microphone source to a capture node. Call start() when the count-in begins and
// stop() when the singer finishes. stop() resolves with every block captured in between.
export async function createCapture(ctx, source) {
  if (!ctx.audioWorklet || typeof globalThis.AudioWorkletNode !== 'function') throw unsupportedError()
  await loadWorklet(ctx)

  const node = new globalThis.AudioWorkletNode(ctx, 'gala-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  })
  // Browsers only run a node that leads to the speakers, so it goes through a gain of zero: no feedback.
  const silence = ctx.createGain()
  silence.gain.value = 0
  source.connect(node)
  node.connect(silence)
  silence.connect(ctx.destination)

  let chunks = []
  let onStopped = null
  node.port.onmessage = (event) => {
    if (event.data?.type === 'stopped') onStopped?.()
    else chunks.push(event.data)
  }

  return {
    start() {
      chunks = []
      node.port.postMessage('start')
    },
    // Messages arrive in order, so when "stopped" comes back every block before it has arrived too.
    stop() {
      return new Promise((resolve) => {
        onStopped = () => resolve(chunks)
        node.port.postMessage('stop')
      })
    },
    dispose() {
      try {
        source.disconnect(node)
      } catch {
        // already disconnected
      }
      node.disconnect()
      silence.disconnect()
      node.port.onmessage = null
    },
  }
}

// Joins captured blocks into one clip covering frames [from, to). Gaps become silence.
export function assembleFrames(chunks, from, to) {
  const out = new Float32Array(Math.max(0, to - from))
  for (const { frame, data } of chunks) {
    const start = Math.max(frame, from)
    const end = Math.min(frame + data.length, to)
    if (end > start) out.set(data.subarray(start - frame, end - frame), start - from)
  }
  return out
}

export const lastFrame = (chunks) => chunks.reduce((max, c) => Math.max(max, c.frame + c.data.length), 0)

// Time between the beat being scheduled and the singer's reply being captured: the beat takes a moment
// to reach the headphones, and the voice takes a moment to get back in. Cutting that much off the
// start of the take puts the voice back where the singer meant it to be.
export function estimateLatencySeconds(ctx, track) {
  const output = (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
  const input = track?.getSettings?.().latency ?? 0
  return output + input
}

export const monoToWavBlob = (samples, sampleRate) =>
  new Blob([encodeWav([samples], sampleRate)], { type: 'audio/wav' })
