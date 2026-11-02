import { describe, expect, test } from 'vitest'
import { NoteRecorder, normalizeNotes, quantizeNotes, scheduleClipNotes } from './notes.js'
import { chordNotes, noteLabel } from './piano.js'
import { addPianoClip, addTrack, emptyTimeline, normalizeTimeline, splitClip, trimClipStart } from './timeline.js'

describe('notes', () => {
  test('normalize repairs bad notes', () => {
    const notes = normalizeNotes([{ midi: 999, start: 1, length: -2 }, { midi: 60, start: 99 }, null, { midi: 62, start: 0 }], 2)
    expect(notes.map((n) => n.midi)).toEqual([62, 108])
    expect(notes[1].length).toBeGreaterThan(0)
  })

  test('quantize snaps to the grid', () => {
    const [n] = quantizeNotes([{ midi: 60, start: 0.27, length: 0.4, velocity: 1 }], 0.25, 1)
    expect(n.start).toBe(0.25)
    expect(n.length).toBe(0.5)
  })

  test('recorder closes held notes and wraps round the loop', () => {
    const r = new NoteRecorder(1)
    r.down(60, 1)
    r.up(60, 2)
    r.down(64, 3.5)
    r.up(64, 0.5) // released after the loop came round
    r.down(67, 2)
    const notes = r.finish(3)
    expect(notes).toHaveLength(3)
    expect(notes.find((n) => n.midi === 64).length).toBeCloseTo(0.5)
    expect(r.down(70, -1)).toBe(false)
  })

  test('a one-bar part repeats across a longer clip', () => {
    const clip = { start: 0, bars: 4, loopBars: 1, shift: 0, notes: [{ midi: 60, start: 0, length: 1, velocity: 1 }] }
    const events = scheduleClipNotes(clip, 120, 0, 100)
    expect(events.map((e) => e.time)).toEqual([0, 2, 4, 6])
  })

  test('the window is half open so no note plays twice', () => {
    const clip = { start: 0, bars: 2, loopBars: 2, shift: 0, notes: [{ midi: 60, start: 4, length: 1, velocity: 1 }] }
    expect(scheduleClipNotes(clip, 120, 0, 2)).toHaveLength(0)
    expect(scheduleClipNotes(clip, 120, 2, 4)).toHaveLength(1)
  })

  test('chords and names', () => {
    expect(chordNotes(60, 'major')).toEqual([60, 64, 67])
    expect(noteLabel(60)).toBe('C4')
  })
})

describe('piano clips on the timeline', () => {
  const build = () => {
    let t = emptyTimeline(120)
    t = addTrack(t, { kind: 'piano', id: 'p' })
    return addPianoClip(t, 'p', { id: 'c', bars: 4, loopBars: 2, notes: [{ midi: 60, start: 0, length: 1 }, { midi: 62, start: 4, length: 1 }] })
  }

  test('adds and survives repair', () => {
    const t = normalizeTimeline(JSON.parse(JSON.stringify(build())))
    expect(t.tracks[0].kind).toBe('piano')
    expect(t.tracks[0].clips[0].notes).toHaveLength(2)
  })

  test('splitting and trimming keep the part in step', () => {
    const split = splitClip(build(), 'c', 2, 'd') // 120 bpm: a bar is 2 s
    const [left, right] = split.tracks[0].clips
    expect(left.bars).toBe(1)
    expect(right.shift).toBe(1)
    const trimmed = trimClipStart(build(), 'c', 2)
    expect(trimmed.tracks[0].clips[0].shift).toBe(1)
    // the second bar of the loop (note D) now plays first
    const events = scheduleClipNotes(trimmed.tracks[0].clips[0], 120, 0, 100)
    expect(events[0].midi).toBe(62)
  })
})
