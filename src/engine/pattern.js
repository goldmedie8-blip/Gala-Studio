// The pattern is the "song" the beat maker edits: drums, a one-note-per-step melody, and the settings
// that go with them. It is plain data so it can be saved, tested and rendered.
import { MELODY_ROWS, SCALES } from './scale.js'
import { SOUNDS } from './voices.js'

export const STEPS = 16
export const MIN_BPM = 60
export const MAX_BPM = 200

export const DRUM_LANES = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'clap', name: 'Clap' },
  { id: 'hat', name: 'Hi-hat' },
  { id: 'openHat', name: 'Open hat' },
  { id: 'perc', name: 'Perc' },
]

export function emptyPattern() {
  return {
    drums: Object.fromEntries(DRUM_LANES.map((lane) => [lane.id, Array(STEPS).fill(false)])),
    melody: Array(STEPS).fill(null),
    sound: 'keys',
    key: 0,
    scale: 'minor-pentatonic',
    bpm: 100,
    swing: 0,
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// Repairs anything loaded from storage so a bad or old save can never crash the app.
export function normalizePattern(raw) {
  const base = emptyPattern()
  if (!raw || typeof raw !== 'object') return base
  const drums = {}
  for (const lane of DRUM_LANES) {
    const row = raw.drums?.[lane.id]
    drums[lane.id] = Array.from({ length: STEPS }, (_, i) => row?.[i] === true)
  }
  const melody = Array.from({ length: STEPS }, (_, i) => {
    const degree = raw.melody?.[i]
    return Number.isInteger(degree) && degree >= 0 && degree < MELODY_ROWS ? degree : null
  })
  const bpm = Number(raw.bpm)
  const swing = Number(raw.swing)
  return {
    drums,
    melody,
    sound: Object.hasOwn(SOUNDS, raw.sound) ? raw.sound : base.sound,
    key: Number.isInteger(raw.key) && raw.key >= 0 && raw.key < 12 ? raw.key : base.key,
    scale: Object.hasOwn(SCALES, raw.scale) ? raw.scale : base.scale,
    bpm: Number.isFinite(bpm) ? clamp(Math.round(bpm), MIN_BPM, MAX_BPM) : base.bpm,
    swing: Number.isFinite(swing) ? clamp(Math.round(swing * 100) / 100, 0, 1) : base.swing,
  }
}

export function toggleDrum(pattern, laneId, step) {
  const row = pattern.drums[laneId].map((on, i) => (i === step ? !on : on))
  return { ...pattern, drums: { ...pattern.drums, [laneId]: row } }
}

// Picking the note that is already there clears the step.
export function setMelodyStep(pattern, step, degree) {
  const melody = pattern.melody.map((d, i) => (i === step ? (d === degree ? null : degree) : d))
  return { ...pattern, melody }
}

export function clearPattern(pattern) {
  const blank = emptyPattern()
  return { ...pattern, drums: blank.drums, melody: blank.melody }
}
