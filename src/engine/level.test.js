import { describe, expect, test } from 'vitest'
import { formatDuration } from './format.js'
import { levelFromTimeDomain } from './level.js'

describe('levelFromTimeDomain', () => {
  test('silence reads zero', () => {
    const result = levelFromTimeDomain(new Float32Array(512))
    expect(result.level).toBe(0)
    expect(result.clipping).toBe(false)
  })

  test('a louder signal reads higher than a quiet one', () => {
    const quiet = levelFromTimeDomain(new Float32Array(512).fill(0.01))
    const loud = levelFromTimeDomain(new Float32Array(512).fill(0.3))
    expect(loud.level).toBeGreaterThan(quiet.level)
    expect(loud.level).toBeLessThanOrEqual(1)
  })

  test('flags clipping when the signal hits the ceiling', () => {
    const samples = new Float32Array(512).fill(0.1)
    samples[10] = 1
    expect(levelFromTimeDomain(samples).clipping).toBe(true)
  })
})

describe('formatDuration', () => {
  test('formats milliseconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(5400)).toBe('0:05')
    expect(formatDuration(83500)).toBe('1:23')
    expect(formatDuration(-5)).toBe('0:00')
  })
})
