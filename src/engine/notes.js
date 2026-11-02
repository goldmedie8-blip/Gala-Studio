// A recorded keyboard part as plain data, and the maths for playing it back. Times are in beats, so a part
// keeps its feel when the tempo changes. Nothing here touches audio or the screen.
import { HIGHEST_NOTE, LOWEST_NOTE } from './piano.js'

export const BEATS_PER_BAR = 4
export const MAX_NOTES = 2000
export const MIN_LENGTH = 0.0625
export const QUANTIZE = [
  { id: 'off', name: 'Off', grid: 0 },
  { id: '8', name: 'Eighth notes', grid: 0.5 },
  { id: '16', name: 'Sixteenth notes', grid: 0.25 },
]

const num = (value, min, max, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const r4 = (n) => Math.round(n * 10000) / 10000

// Repairs saved notes: keeps valid ones, in order, inside the part.
export function normalizeNotes(raw, bars = 64) {
  const end = Math.max(1, bars) * BEATS_PER_BAR
  return (Array.isArray(raw) ? raw : [])
    .map((n) => {
      if (!n || typeof n !== 'object') return null
      const start = r4(num(n.start, 0, end, NaN))
      if (!Number.isFinite(start) || start >= end) return null
      return {
        midi: Math.round(num(n.midi, LOWEST_NOTE, HIGHEST_NOTE, 60)),
        start,
        length: r4(num(n.length, MIN_LENGTH, 16, 0.5)),
        velocity: num(n.velocity, 0.05, 1, 0.8),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.midi - b.midi)
    .slice(0, MAX_NOTES)
}

// Pulls every note onto the grid so a loose performance sounds tight. grid 0 leaves it as played.
export function quantizeNotes(notes, grid, bars) {
  if (!grid) return notes
  const end = bars * BEATS_PER_BAR
  return notes
    .map((n) => {
      const start = Math.round(n.start / grid) * grid
      const length = Math.max(grid, Math.round(n.length / grid) * grid)
      return { ...n, start: r4(start >= end ? end - grid : start), length: r4(length) }
    })
    .sort((a, b) => a.start - b.start || a.midi - b.midi)
}

export const getGrid = (id) => QUANTIZE.find((q) => q.id === id)?.grid ?? 0

// Collects what is played on the keyboard. Beats are counted from the start of the part. When recording
// loops, a note held across the end is cut at the end of the part.
export class NoteRecorder {
  constructor(bars) {
    this.bars = bars
    this.total = bars * BEATS_PER_BAR
    this.held = new Map()
    this.notes = []
  }

  down(midi, beat, velocity = 0.8) {
    if (beat < 0 || beat >= this.total) return false
    this.held.set(midi, { start: beat, velocity })
    return true
  }

  up(midi, beat) {
    const open = this.held.get(midi)
    if (!open) return
    this.held.delete(midi)
    const end = beat >= open.start ? beat : this.total // wrapped round the loop
    this.notes.push({ midi, start: open.start, length: Math.max(MIN_LENGTH, Math.min(end, this.total) - open.start), velocity: open.velocity })
  }

  // Ends anything still held at `beat` and returns the notes.
  finish(beat) {
    for (const midi of [...this.held.keys()]) this.up(midi, beat)
    return normalizeNotes(this.notes, this.bars)
  }
}

const mod = (n, m) => ((n % m) + m) % m

// The notes of a looping part that start inside [a, b) of timeline time. The part is `loopBars` long and
// repeats to fill `bars`; `shift` says how many bars into the loop the clip begins (after a trim or split).
// Returns { time (seconds on the timeline), midi, seconds, velocity }.
export function scheduleClipNotes(clip, bpm, a, b) {
  const beat = 60 / bpm
  const bar = beat * BEATS_PER_BAR
  const loopBars = Math.max(1, clip.loopBars ?? clip.bars)
  const shift = clip.shift ?? 0
  const events = []
  const first = Math.max(0, Math.floor((a - clip.start) / bar) - 1)
  const last = Math.min(clip.bars - 1, Math.ceil((b - clip.start) / bar))
  for (let g = first; g <= last; g++) {
    const loopBar = mod(g + shift, loopBars)
    const barStart = clip.start + g * bar
    for (const note of clip.notes) {
      const into = note.start - loopBar * BEATS_PER_BAR
      if (into < 0 || into >= BEATS_PER_BAR) continue
      const time = barStart + into * beat
      if (time < a || time >= b) continue
      const stop = clip.start + clip.bars * bar
      events.push({ time, midi: note.midi, seconds: Math.max(0.05, Math.min(note.length * beat, stop - time)), velocity: note.velocity })
    }
  }
  return events
}
