import { describe, expect, test } from 'vitest'
import { emptyHits, hitsToPattern, normalizeHits, setHit, stepFor } from './drumPart.js'

describe('drum part', () => {
  test('hits land on the nearest sixteenth and wrap round the loop', () => {
    expect(stepFor(0.26, 1)).toBe(1)
    expect(stepFor(3.9, 1)).toBe(0) // just before the next bar counts as its first step
    expect(stepFor(5, 2)).toBe(4 * 5 - 0)
  })

  test('each bar becomes a section of a beat', () => {
    let hits = emptyHits(2)
    hits = setHit(hits, 'kick', 0)
    hits = setHit(hits, 'snare', 20)
    const pattern = hitsToPattern(hits, 2, { bpm: 90 })
    expect(pattern.order).toEqual([0, 1])
    expect(pattern.sections[0].drums.kick[0]).toBe(true)
    expect(pattern.sections[1].drums.snare[4]).toBe(true)
    expect(pattern.bpm).toBe(90)
  })

  test('damaged data is repaired', () => {
    expect(normalizeHits({ kick: [true, 'x'] }, 1).kick.slice(0, 2)).toEqual([true, false])
  })
})
