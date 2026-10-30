// The pattern is the "song" the beat maker edits. It is plain data so it can be saved, tested and rendered.
//
// A beat is built from up to four sections (A to D). Each section is one bar of drums, a melody line
// and a bass line. The arrangement ("order") says which section plays in each bar, so a beat can have a
// groove, a hook, a break and a fill instead of one loop.
//
// The section being edited lives at the top of the pattern (pattern.drums, pattern.melody, pattern.bass).
// The other sections are kept in pattern.sections. The entry for the section being edited is ignored, so
// the two copies can never disagree.
import { MELODY_ROWS, SCALES } from './scale.js'
import { SOUNDS } from './voices.js'

export const STEPS = 16
export const MIN_BPM = 60
export const MAX_BPM = 200
export const SECTION_COUNT = 4
export const MAX_BARS = 16
export const SECTION_NAMES = ['Groove', 'Hook', 'Break', 'Fill']
export const SECTION_LETTERS = ['A', 'B', 'C', 'D']

export const DRUM_LANES = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'clap', name: 'Clap' },
  { id: 'hat', name: 'Hi-hat' },
  { id: 'openHat', name: 'Open hat' },
  { id: 'perc', name: 'Perc' },
  { id: 'rim', name: 'Rim' },
  { id: 'shaker', name: 'Shaker' },
  { id: 'conga', name: 'Conga' },
  { id: 'cowbell', name: 'Cowbell' },
]

export function emptySection() {
  return {
    drums: Object.fromEntries(DRUM_LANES.map((lane) => [lane.id, Array(STEPS).fill(false)])),
    melody: Array(STEPS).fill(null),
    bass: Array(STEPS).fill(null),
  }
}

export function emptyPattern() {
  return {
    ...emptySection(),
    sections: Array.from({ length: SECTION_COUNT }, emptySection),
    active: 0,
    order: [0],
    sound: 'keys',
    bassSound: 'bass',
    key: 0,
    scale: 'minor-pentatonic',
    bpm: 100,
    swing: 0,
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const isSectionIndex = (n) => Number.isInteger(n) && n >= 0 && n < SECTION_COUNT

const cleanNotes = (row) =>
  Array.from({ length: STEPS }, (_, i) => {
    const degree = row?.[i]
    return Number.isInteger(degree) && degree >= 0 && degree < MELODY_ROWS ? degree : null
  })

// Repairs one section of drums, melody and bass.
function normalizeSection(raw) {
  const drums = {}
  for (const lane of DRUM_LANES) {
    const row = raw?.drums?.[lane.id]
    drums[lane.id] = Array.from({ length: STEPS }, (_, i) => row?.[i] === true)
  }
  return { drums, melody: cleanNotes(raw?.melody), bass: cleanNotes(raw?.bass) }
}

// Repairs anything loaded from storage so a bad or old save can never crash the app. Saves from before
// sections existed load as a beat with one section.
export function normalizePattern(raw) {
  const base = emptyPattern()
  if (!raw || typeof raw !== 'object') return base
  const bpm = Number(raw.bpm)
  const swing = Number(raw.swing)
  const order = Array.isArray(raw.order) ? raw.order.filter(isSectionIndex).slice(0, MAX_BARS) : []
  return {
    ...normalizeSection(raw),
    sections: Array.from({ length: SECTION_COUNT }, (_, i) => normalizeSection(raw.sections?.[i])),
    active: isSectionIndex(raw.active) ? raw.active : 0,
    order: order.length ? order : [0],
    sound: Object.hasOwn(SOUNDS, raw.sound) ? raw.sound : base.sound,
    bassSound: Object.hasOwn(SOUNDS, raw.bassSound) ? raw.bassSound : base.bassSound,
    key: Number.isInteger(raw.key) && raw.key >= 0 && raw.key < 12 ? raw.key : base.key,
    scale: Object.hasOwn(SCALES, raw.scale) ? raw.scale : base.scale,
    bpm: Number.isFinite(bpm) ? clamp(Math.round(bpm), MIN_BPM, MAX_BPM) : base.bpm,
    swing: Number.isFinite(swing) ? clamp(Math.round(swing * 100) / 100, 0, 1) : base.swing,
  }
}

// ---- editing the section that is open -------------------------------------------------------------

export function toggleDrum(pattern, laneId, step) {
  const row = pattern.drums[laneId].map((on, i) => (i === step ? !on : on))
  return { ...pattern, drums: { ...pattern.drums, [laneId]: row } }
}

// Picking the note that is already there clears the step. `track` is 'melody' or 'bass'.
export function setNoteStep(pattern, track, step, degree) {
  const row = (pattern[track] ?? Array(STEPS).fill(null)).map((d, i) => (i === step ? (d === degree ? null : degree) : d))
  return { ...pattern, [track]: row }
}

export const setMelodyStep = (pattern, step, degree) => setNoteStep(pattern, 'melody', step, degree)
export const setBassStep = (pattern, step, degree) => setNoteStep(pattern, 'bass', step, degree)

// Empties the section that is open. Tempo, sounds and the other sections stay.
export function clearPattern(pattern) {
  return { ...pattern, ...emptySection() }
}

// ---- sections and arrangement ---------------------------------------------------------------------

// What a section holds, whether or not it is the one being edited.
export function sectionData(pattern, index) {
  if (index === (pattern.active ?? 0)) return pattern
  return pattern.sections?.[index] ?? emptySection()
}

const copyOf = (data) => ({
  drums: Object.fromEntries(Object.entries(data.drums).map(([id, row]) => [id, [...row]])),
  melody: [...data.melody],
  bass: [...(data.bass ?? Array(STEPS).fill(null))],
})

// Opens another section for editing. Nothing is lost: the open section is put away first.
export function switchSection(pattern, index) {
  if (!isSectionIndex(index) || index === pattern.active) return pattern
  const sections = pattern.sections.map((s, i) => (i === pattern.active ? copyOf(pattern) : s))
  return { ...pattern, ...copyOf(sections[index]), sections, active: index }
}

// Fills the open section with a copy of another one, to build a variation from it.
export function copySection(pattern, from) {
  if (!isSectionIndex(from) || from === pattern.active) return pattern
  return { ...pattern, ...copyOf(sectionData(pattern, from)) }
}

// Chooses which section plays in a bar.
export function setBarSection(pattern, bar, index) {
  if (!isSectionIndex(index) || bar < 0 || bar >= pattern.order.length) return pattern
  return { ...pattern, order: pattern.order.map((s, i) => (i === bar ? index : s)) }
}

// A new bar repeats the section that is open, so the song grows from what you are working on.
export function addBar(pattern) {
  if (pattern.order.length >= MAX_BARS) return pattern
  return { ...pattern, order: [...pattern.order, pattern.active] }
}

export function removeBar(pattern) {
  if (pattern.order.length <= 1) return pattern
  return { ...pattern, order: pattern.order.slice(0, -1) }
}

// The same beat, but looping only the section that is open (used to work on one section at a time).
export const loopSection = (pattern) => ({ ...pattern, order: [pattern.active ?? 0] })

export const arrangementLength = (pattern) => Math.max(1, pattern.order?.length ?? 1) * STEPS

// Turns a running step count into a bar, a step inside that bar and the section that plays there.
export function locateStep(pattern, step) {
  const order = pattern.order?.length ? pattern.order : [0]
  const total = order.length * STEPS
  const s = ((step % total) + total) % total
  const bar = Math.floor(s / STEPS)
  const index = order[bar]
  return { bar, local: s % STEPS, index, section: sectionData(pattern, index) }
}
