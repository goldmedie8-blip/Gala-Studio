import { afterEach, describe, expect, test, vi } from 'vitest'
import { getAudioContext, resetAudioContextForTests, unlockAudio } from './audioContext.js'
import { RECORDING_CONSTRAINTS, audioInputConstraints } from './constraints.js'

class FakeAudioContext {
  constructor(options) {
    this.options = options
    this.state = 'suspended'
    this.resume = vi.fn(async () => {
      this.state = 'running'
    })
  }
}

afterEach(() => {
  resetAudioContextForTests()
  vi.unstubAllGlobals()
})

describe('audio context', () => {
  test('creates a single shared context tuned for low latency', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const first = getAudioContext()
    expect(getAudioContext()).toBe(first)
    expect(first.options).toEqual({ latencyHint: 'interactive' })
  })

  test('unlockAudio resumes a suspended context', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const ctx = await unlockAudio()
    expect(ctx.resume).toHaveBeenCalledOnce()
    expect(ctx.state).toBe('running')
  })

  test('explains clearly when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    expect(() => getAudioContext()).toThrow(/not supported/)
  })
})

describe('recording constraints', () => {
  test('turns off the call-style processing that colours music', () => {
    expect(RECORDING_CONSTRAINTS.echoCancellation).toBe(false)
    expect(RECORDING_CONSTRAINTS.noiseSuppression).toBe(false)
    expect(RECORDING_CONSTRAINTS.autoGainControl).toBe(false)
  })

  test('pins a chosen input device', () => {
    expect(audioInputConstraints('mic-1').audio.deviceId).toEqual({ exact: 'mic-1' })
    expect(audioInputConstraints().audio.deviceId).toBeUndefined()
  })
})
