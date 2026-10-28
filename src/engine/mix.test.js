import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext, fakeVoiceBuffer } from '../../tests/fakeAudio.js'
import { bpmFromTaps } from './tempo.js'
import { emptyPattern, toggleDrum } from './pattern.js'
import { clampOffset, decodeAudioBlob, peaksFromBuffer, planStart, renderMix, scheduleBeatRange } from './mix.js'
import { Sequencer } from './sequencer.js'
import { DRUMS } from './voices.js'
import { BEAT_STORAGE_KEY, loadBeat, saveBeat } from '../storage/beatStore.js'

describe('planStart', () => {
  test('a positive offset delays the beat, a negative one delays the voice', () => {
    expect(planStart(1.5)).toEqual({ voiceDelay: 0, beatDelay: 1.5 })
    expect(planStart(-0.5)).toEqual({ voiceDelay: 0.5, beatDelay: 0 })
    expect(planStart(0)).toEqual({ voiceDelay: 0, beatDelay: 0 })
  })

  test('clampOffset keeps nudges inside the allowed range and ignores junk', () => {
    expect(clampOffset(99)).toBe(20)
    expect(clampOffset(-9)).toBe(-2)
    expect(clampOffset('abc')).toBe(0)
    expect(clampOffset(0.123)).toBe(0.12)
  })
})

describe('peaksFromBuffer', () => {
  test('returns the requested number of values from 0 to 1, loudest at 1', () => {
    const peaks = peaksFromBuffer(fakeVoiceBuffer(), 50)
    expect(peaks).toHaveLength(50)
    expect(Math.max(...peaks)).toBeCloseTo(1)
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0)
    expect(peaks[45]).toBeGreaterThan(peaks[5]) // the fake voice gets louder
  })

  test('silence stays silent instead of dividing by zero', () => {
    const silent = { getChannelData: () => new Float32Array(1000) }
    expect(peaksFromBuffer(silent, 10).every((p) => p === 0)).toBe(true)
  })
})

describe('decodeAudioBlob', () => {
  test('hands the bytes of the blob to the audio decoder', async () => {
    const ctx = new FakeAudioContext()
    const buffer = await decodeAudioBlob(ctx, new Blob(['voice']))
    expect(ctx.decodeAudioData).toHaveBeenCalledOnce()
    expect(buffer.duration).toBe(2)
  })
})

describe('bpmFromTaps', () => {
  test('needs at least two taps', () => {
    expect(bpmFromTaps([])).toBeNull()
    expect(bpmFromTaps([1000])).toBeNull()
  })

  test('works out the tempo from steady taps', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120)
    expect(bpmFromTaps([0, 600, 1200])).toBe(100)
  })

  test('forgets taps from before a long pause', () => {
    expect(bpmFromTaps([0, 5000, 5500, 6000])).toBe(120)
  })

  test('folds very slow or very fast tapping into the supported range', () => {
    expect(bpmFromTaps([0, 2000 - 1])).toBe(60) // roughly 30 BPM doubled
    expect(bpmFromTaps([0, 100, 200])).toBe(150) // 600 BPM halved twice
  })

  test('only the latest eight taps count', () => {
    const times = [0, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500]
    expect(bpmFromTaps(times)).toBe(120)
  })
})

describe('scheduleBeatRange', () => {
  test('repeats the pattern until the end time', () => {
    const ctx = new FakeAudioContext()
    const kick = vi.spyOn(DRUMS, 'kick')
    const pattern = toggleDrum({ ...emptyPattern(), bpm: 120 }, 'kick', 0)
    scheduleBeatRange(ctx, ctx.createGain(), pattern, { start: 0, until: 6 })
    // 120 BPM: one bar is 2 seconds, so a kick on step 1 lands at 0, 2 and 4
    expect(kick.mock.calls.map((c) => c[2])).toEqual([0, 2, 4])
    kick.mockRestore()
  })

  test('starts when the beat is told to start', () => {
    const ctx = new FakeAudioContext()
    const kick = vi.spyOn(DRUMS, 'kick')
    const pattern = toggleDrum({ ...emptyPattern(), bpm: 120 }, 'kick', 0)
    scheduleBeatRange(ctx, ctx.createGain(), pattern, { start: 1.5, until: 4 })
    expect(kick.mock.calls.map((c) => c[2])).toEqual([1.5, 3.5])
    kick.mockRestore()
  })
})

describe('renderMix', () => {
  let instances
  class CapturingOfflineContext extends FakeOfflineAudioContext {
    constructor(...args) {
      super(...args)
      this.sources = []
      const make = this.createBufferSource
      this.createBufferSource = () => {
        const node = make()
        this.sources.push(node)
        return node
      }
      instances.push(this)
    }
  }

  beforeEach(() => {
    instances = []
    vi.stubGlobal('OfflineAudioContext', CapturingOfflineContext)
  })
  afterEach(() => vi.unstubAllGlobals())

  const kickOnly = toggleDrum({ ...emptyPattern(), bpm: 120 }, 'kick', 0)

  test('makes a WAV as long as the voice plus a tail', async () => {
    const blob = await renderMix({ voice: fakeVoiceBuffer(2), pattern: kickOnly, sampleRate: 8000 })
    const frames = Math.ceil((2 + 1.5) * 8000)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + frames * 4)
  })

  test('a negative offset starts the voice later and lengthens the file', async () => {
    const blob = await renderMix({ voice: fakeVoiceBuffer(2), pattern: kickOnly, offset: -1, sampleRate: 8000 })
    expect(blob.size).toBe(44 + Math.ceil((1 + 2 + 1.5) * 8000) * 4)
    expect(instances[0].sources[0].start).toHaveBeenCalledWith(1)
  })

  test('a positive offset keeps the voice at the start', async () => {
    await renderMix({ voice: fakeVoiceBuffer(2), pattern: kickOnly, offset: 1, sampleRate: 8000 })
    expect(instances[0].sources[0].start).toHaveBeenCalledWith(0)
  })

  test('explains when the browser cannot export', async () => {
    vi.stubGlobal('OfflineAudioContext', undefined)
    vi.stubGlobal('webkitOfflineAudioContext', undefined)
    await expect(renderMix({ voice: fakeVoiceBuffer(), pattern: kickOnly })).rejects.toThrow(/not supported/)
  })
})

describe('Sequencer.start(at)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('step 0 lands exactly at the requested audio time', () => {
    let now = 0
    const played = []
    const seq = new Sequencer({
      getTime: () => now,
      getBpm: () => 120,
      getSwing: () => 0,
      play: (step, time) => played.push([step, time]),
    })
    seq.start(5)
    expect(played).toEqual([]) // nothing is scheduled until the clock gets close
    now = 5.01
    vi.advanceTimersByTime(25)
    expect(played[0]).toEqual([0, 5])
    expect(played[1][1]).toBeCloseTo(5.125)
    seq.stop()
  })
})

describe('shared beat storage', () => {
  beforeEach(() => localStorage.clear())

  test('saves and loads a pattern', () => {
    const pattern = toggleDrum({ ...emptyPattern(), bpm: 133 }, 'snare', 4)
    saveBeat(pattern)
    expect(loadBeat()).toEqual(pattern)
  })

  test('reads exactly what the Beats tool writes', () => {
    const pattern = { ...emptyPattern(), bpm: 90 }
    localStorage.setItem(BEAT_STORAGE_KEY, JSON.stringify(pattern))
    expect(loadBeat().bpm).toBe(90)
  })

  test('returns null when nothing is saved or the save is broken', () => {
    expect(loadBeat()).toBeNull()
    localStorage.setItem(BEAT_STORAGE_KEY, '{oops')
    expect(loadBeat()).toBeNull()
  })
})
