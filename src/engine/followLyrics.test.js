import { describe, expect, test } from 'vitest'
import { barSeconds, lineAtTime, lyricLines } from './followLyrics.js'

const song = (...texts) => ({
  title: '',
  language: 'english',
  sections: texts.map((text, i) => ({ id: `s${i}`, type: i % 2 === 0 ? 'verse' : 'hook', text, chords: '' })),
})

describe('following lyrics', () => {
  test('a bar is four beats', () => {
    expect(barSeconds(120)).toBe(2)
    expect(barSeconds(60)).toBe(4)
    expect(barSeconds(0)).toBeGreaterThan(0)
  })

  test('lines come out in song order with their section, skipping blanks', () => {
    const lines = lyricLines(song('one\n\n  \ntwo', 'three'))
    expect(lines.map((l) => l.text)).toEqual(['one', 'two', 'three'])
    expect(lines.map((l) => l.section)).toEqual(['Verse', 'Verse', 'Hook'])
    expect(lines.map((l) => l.first)).toEqual([true, false, true])
  })

  test('one line a bar', () => {
    expect(lineAtTime(3, 0, 120)).toBe(0)
    expect(lineAtTime(3, 1.9, 120)).toBe(0)
    expect(lineAtTime(3, 2, 120)).toBe(1)
    expect(lineAtTime(3, 5.5, 120)).toBe(2)
  })

  test('two lines a bar', () => {
    expect(lineAtTime(4, 0.9, 120, 2)).toBe(0)
    expect(lineAtTime(4, 1, 120, 2)).toBe(1)
    expect(lineAtTime(4, 2.5, 120, 2)).toBe(2)
  })

  test('nothing is sung before the beat starts or after the last line', () => {
    expect(lineAtTime(3, -0.5, 120)).toBe(-1)
    expect(lineAtTime(3, 6, 120)).toBe(-1)
    expect(lineAtTime(0, 1, 120)).toBe(-1)
    expect(lineAtTime(3, Number.NaN, 120)).toBe(-1)
  })
})
