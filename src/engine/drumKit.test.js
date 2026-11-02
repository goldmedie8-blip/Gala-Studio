import { beforeEach, describe, expect, test } from 'vitest'
import {
  MAX_SAMPLE_SECONDS,
  analyzeBuffer,
  forgetSamples,
  getSample,
  loadKit,
  loadSample,
  normalizeKit,
  playSample,
  readKit,
  setLaneSound,
} from './drumKit.js'

// A tiny fake recording: `parts` is a list of [numberOfSamples, amplitude].
function recording(parts, sampleRate = 1000) {
  const values = parts.flatMap(([count, amplitude]) => Array(count).fill(amplitude))
  const data = Float32Array.from(values)
  return { numberOfChannels: 1, sampleRate, length: data.length, duration: data.length / sampleRate, getChannelData: () => data }
}
const close = (a, b) => Math.abs(a - b) < 1e-6

const deps = (buffer, { exists = true } = {}) => ({
  fetchTake: async (id) => (exists ? { id, blob: { arrayBuffer: async () => new ArrayBuffer(8) } } : undefined),
  decode: async () => buffer,
})

beforeEach(() => {
  localStorage.clear()
  forgetSamples()
})

describe('turning a recording into a drum sound', () => {
  test('silence cannot be a sound', () => {
    expect(analyzeBuffer(recording([[500, 0]]))).toBe(null)
    expect(analyzeBuffer(recording([[500, 0.0004]]))).toBe(null)
  })

  test('silence at the start is cut so the hit lands on the beat', () => {
    const result = analyzeBuffer(recording([[100, 0], [400, 0.4]]))
    expect(close(result.offset, 0.098)).toBe(true) // the hit starts at 0.100 s, with a 2 ms head start
    expect(close(result.duration, 0.402)).toBe(true)
  })

  test('faint noise before the hit does not count as the start', () => {
    const result = analyzeBuffer(recording([[100, 0.01], [400, 1]]))
    expect(close(result.offset, 0.098)).toBe(true)
  })

  test('quiet recordings are turned up, but only so far', () => {
    expect(close(analyzeBuffer(recording([[200, 0.4]])).gain, 2)).toBe(true)
    expect(analyzeBuffer(recording([[200, 0.05]])).gain).toBe(4)
    expect(close(analyzeBuffer(recording([[200, 1]])).gain, 0.8)).toBe(true)
  })

  test('a long recording is cut to a short hit', () => {
    expect(analyzeBuffer(recording([[5000, 0.5]])).duration).toBe(MAX_SAMPLE_SECONDS)
  })

  test('a recording that ends right after the silence is rejected', () => {
    expect(analyzeBuffer(recording([[500, 0], [2, 0.5]]))).toBe(null)
  })

  test('either channel can carry the hit', () => {
    const left = Float32Array.from(Array(300).fill(0))
    const right = Float32Array.from([...Array(100).fill(0), ...Array(200).fill(0.5)])
    const stereo = { numberOfChannels: 2, sampleRate: 1000, length: 300, duration: 0.3, getChannelData: (c) => (c === 0 ? left : right) }
    expect(close(analyzeBuffer(stereo).offset, 0.098)).toBe(true)
  })
})

describe('choosing a sound for a lane', () => {
  test('a lane plays your recording once you choose it, and it is remembered', async () => {
    await setLaneSound('kick', 't1', deps(recording([[300, 0.5]])))
    expect(getSample('kick').takeId).toBe('t1')
    expect(readKit()).toEqual({ kick: 't1' })
  })

  test('going back to the built-in sound removes it', async () => {
    await setLaneSound('kick', 't1', deps(recording([[300, 0.5]])))
    await setLaneSound('kick', null)
    expect(getSample('kick')).toBe(undefined)
    expect(readKit()).toEqual({})
  })

  test('a recording that cannot be used changes nothing and says why', async () => {
    await setLaneSound('kick', 't1', deps(recording([[300, 0.5]])))
    let message = ''
    try {
      await setLaneSound('kick', 't2', deps(recording([[300, 0]])))
    } catch (e) {
      message = e.message
    }
    expect(message).toBe('That recording could not be used as a sound. Try a short recording of a single hit.')
    expect(getSample('kick').takeId).toBe('t1')
    expect(readKit()).toEqual({ kick: 't1' })
  })

  test('a deleted recording is reported the same way', async () => {
    let failed = false
    try {
      await setLaneSound('snare', 'gone', deps(recording([[300, 0.5]]), { exists: false }))
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  test('only real drum lanes can be set', async () => {
    await setLaneSound('banjo', 't1', deps(recording([[300, 0.5]])))
    expect(readKit()).toEqual({})
  })

  test('damaged saves are ignored', () => {
    localStorage.setItem('gala.kit.v1', '{not json')
    expect(readKit()).toEqual({})
    expect(normalizeKit({ kick: 5, snare: '', hat: 'ok', banjo: 'x' })).toEqual({ hat: 'ok' })
  })
})

describe('getting the kit ready', () => {
  test('remembered sounds load, and one that is gone is skipped', async () => {
    localStorage.setItem('gala.kit.v1', JSON.stringify({ kick: 't1', snare: 't2' }))
    const fetchTake = async (id) => (id === 't1' ? { id, blob: { arrayBuffer: async () => new ArrayBuffer(8) } } : undefined)
    const count = await loadKit({ fetchTake, decode: async () => recording([[300, 0.5]]) })
    expect(count).toBe(1)
    expect(getSample('kick').takeId).toBe('t1')
    expect(getSample('snare')).toBe(undefined)
  })

  test('a recording the browser cannot decode is skipped without an error', async () => {
    localStorage.setItem('gala.kit.v1', JSON.stringify({ kick: 't1' }))
    const count = await loadKit({
      fetchTake: async (id) => ({ id, blob: { arrayBuffer: async () => new ArrayBuffer(8) } }),
      decode: async () => {
        throw new Error('bad audio')
      },
    })
    expect(count).toBe(0)
  })

  test('loadSample returns null for a missing recording', async () => {
    expect(await loadSample('x', deps(recording([[300, 0.5]]), { exists: false }))).toBe(null)
  })
})

describe('playing a sound', () => {
  test('it starts at the hit, for its length, with a fade at the end', () => {
    const calls = { gain: [], ramps: [], start: null, connected: [] }
    const ctx = {
      createBufferSource: () => ({ connect: (n) => calls.connected.push(n), start: (...a) => (calls.start = a) }),
      createGain: () => ({
        gain: { setValueAtTime: (...a) => calls.gain.push(a), linearRampToValueAtTime: (...a) => calls.ramps.push(a) },
        connect: (n) => calls.connected.push(n),
      }),
    }
    const dest = { dest: true }
    playSample(ctx, dest, { buffer: { b: 1 }, offset: 0.1, duration: 0.5, gain: 2 }, 10)
    expect(calls.start).toEqual([10, 0.1, 0.5])
    expect(calls.gain[0]).toEqual([2, 10])
    expect(calls.ramps).toEqual([[0, 10.5]])
    expect(calls.connected.includes(dest)).toBe(true)
  })
})
