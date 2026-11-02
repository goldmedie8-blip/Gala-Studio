import { describe, expect, test } from 'vitest'
import { ceilingCurve, compressorSettings, delaySeconds, masteringSettings } from './effects.js'
import { measureLoudness } from './loudness.js'

const sine = (amp, seconds, rate = 48000, hz = 997) => Float32Array.from({ length: seconds * rate }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate))

describe('loudness', () => {
  test('a -20 dB tone in both ears reads about -20 LUFS', () => {
    const tone = sine(0.1, 6)
    const { lufs, peakDb } = measureLoudness([tone, tone], 48000)
    expect(lufs).toBeGreaterThan(-20.4)
    expect(lufs).toBeLessThan(-19.6)
    expect(peakDb).toBeCloseTo(-20, 0)
  })

  test('half the amplitude is 6 dB quieter', () => {
    const loud = measureLoudness([sine(0.2, 5), sine(0.2, 5)], 48000).lufs
    const soft = measureLoudness([sine(0.1, 5), sine(0.1, 5)], 48000).lufs
    expect(loud - soft).toBeCloseTo(6.02, 1)
  })

  test('silence around the music does not change the reading, and pure silence is silent', () => {
    const tone = sine(0.1, 5)
    const padded = new Float32Array(48000 * 12)
    padded.set(tone, 48000 * 3)
    const plain = measureLoudness([tone, tone], 48000).lufs
    expect(measureLoudness([padded, padded], 48000).lufs).toBeCloseTo(plain, 0)
    expect(measureLoudness([new Float32Array(96000)], 48000).lufs).toBe(-Infinity)
  })
})

describe('effects settings', () => {
  test('more compression means a lower threshold, higher ratio and more make-up', () => {
    const a = compressorSettings(0.2)
    const b = compressorSettings(0.9)
    expect(b.threshold).toBeLessThan(a.threshold)
    expect(b.ratio).toBeGreaterThan(a.ratio)
    expect(b.makeup).toBeGreaterThan(a.makeup)
    expect(compressorSettings(0).ratio).toBe(1)
  })

  test('echo timing follows the tempo', () => {
    expect(delaySeconds(120, 'quarter')).toBeCloseTo(0.5)
    expect(delaySeconds(120, 'eighth')).toBeCloseTo(0.25)
    expect(delaySeconds(120, 'dotted')).toBeCloseTo(0.375)
  })

  test('the ceiling never lets a sample past it, but leaves quiet sound alone', () => {
    const { ceilingGain } = masteringSettings({ preset: 'streaming' })
    const curve = ceilingCurve(ceilingGain)
    expect(Math.max(...curve)).toBeLessThanOrEqual(ceilingGain + 1e-6)
    const mid = Math.floor(curve.length / 2) + 40
    expect(curve[mid]).toBeCloseTo((mid / (curve.length - 1)) * 2 - 1, 2)
  })

  test('boost only applies to a mastering style, and is limited', () => {
    expect(masteringSettings({ preset: 'off', boost: 9 }).makeupGain).toBeCloseTo(masteringSettings({ preset: 'off' }).makeupGain)
    expect(masteringSettings({ preset: 'club', boost: 99 }).makeupGain).toBeLessThan(10 ** (23 / 20))
  })
})
