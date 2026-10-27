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
}

export class FakeOfflineAudioContext extends FakeAudioContext {
  constructor(channels, length, sampleRate) {
    super()
    this.length = length
    this.sampleRate = sampleRate
  }
  startRendering = async () => ({ getChannelData: () => new Float32Array(this.length) })
}
