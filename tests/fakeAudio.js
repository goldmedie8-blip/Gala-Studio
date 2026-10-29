// Stand-ins for the Web Audio API, which does not exist in the test environment.
import { vi } from 'vitest'

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
})

function node() {
  return {
    connect: vi.fn((destination) => destination),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    gain: param(),
    frequency: param(),
    Q: param(),
    threshold: param(),
    ratio: param(),
  }
}

export class FakeAudioContext {
  constructor() {
    this.currentTime = 0
    this.sampleRate = 44100
    this.state = 'running'
    this.destination = node()
    this.resume = vi.fn(async () => {})
  }
  createGain = () => node()
  createOscillator = () => node()
  createBufferSource = () => node()
  createBiquadFilter = () => node()
  createDynamicsCompressor = () => node()
  createBuffer = (channels, length) => ({ getChannelData: () => new Float32Array(length) })
  createMediaStreamSource = () => node()
  createAnalyser = () => ({
    ...node(),
    fftSize: 0,
    getFloatTimeDomainData: (buffer) => buffer.fill(0.2),
  })
  audioWorklet = { addModule: vi.fn(async () => {}) }
  baseLatency = 0
  outputLatency = 0
  // A 2 second "voice" that gets louder, so the waveform has a shape.
  decodeAudioData = vi.fn(async () => fakeVoiceBuffer())
}

// Stand-in for the capture node. Tests push microphone blocks into it with emit().
export class FakeWorkletNode {
  static instances = []
  constructor() {
    this.connect = vi.fn((destination) => destination)
    this.disconnect = vi.fn()
    this.port = {
      onmessage: null,
      postMessage: vi.fn((message) => {
        if (message === 'stop') queueMicrotask(() => this.port.onmessage?.({ data: { type: 'stopped' } }))
      }),
    }
    FakeWorkletNode.instances.push(this)
  }
  emit(frame, data) {
    this.port.onmessage?.({ data: { frame, data } })
  }
}

export function fakeVoiceBuffer(seconds = 2, sampleRate = 44100) {
  const data = new Float32Array(seconds * sampleRate)
  for (let i = 0; i < data.length; i++) data[i] = Math.sin(i / 20) * (i / data.length)
  return { duration: seconds, length: data.length, sampleRate, numberOfChannels: 1, getChannelData: () => data }
}

export class FakeOfflineAudioContext extends FakeAudioContext {
  constructor(channels, length, sampleRate) {
    super()
    this.length = length
    this.sampleRate = sampleRate
  }
  startRendering = async () => ({ getChannelData: () => new Float32Array(this.length) })
}
