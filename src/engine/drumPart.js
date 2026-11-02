// A played drum part as plain data: for each drum, which sixteenth steps are hit over a few bars.
// It turns into an ordinary beat pattern (one section per bar) so it plays like any other beat.
import { DRUM_LANES, MAX_BPM, MIN_BPM, SECTION_COUNT, STEPS, emptyPattern, normalizePattern } from './pattern.js'

export const MAX_DRUM_BARS = SECTION_COUNT // one section (A to D) per bar

export const emptyHits = (bars) => Object.fromEntries(DRUM_LANES.map((l) => [l.id, Array(bars * STEPS).fill(false)]))

export function normalizeHits(raw, bars) {
  return Object.fromEntries(DRUM_LANES.map((l) => [l.id, Array.from({ length: bars * STEPS }, (_, i) => raw?.[l.id]?.[i] === true)]))
}

export const hasHits = (hits) => Object.values(hits).some((row) => row.some(Boolean))

export const toggleHit = (hits, lane, step) => ({ ...hits, [lane]: hits[lane].map((v, i) => (i === step ? !v : v)) })
export const setHit = (hits, lane, step) => (hits[lane]?.[step] ? hits : toggleHit(hits, lane, step))

// The step a hit lands on: the nearest sixteenth, wrapping round the end of the part.
export const stepFor = (beats, bars) => ((Math.round(beats * 4) % (bars * STEPS)) + bars * STEPS) % (bars * STEPS)

export function hitsToPattern(hits, bars, { bpm = 100, swing = 0 } = {}) {
  const base = emptyPattern()
  const sections = Array.from({ length: SECTION_COUNT }, (_, k) => {
    const section = { ...base.sections[0], drums: {} }
    for (const lane of DRUM_LANES) section.drums[lane.id] = hits[lane.id].slice(k * STEPS, (k + 1) * STEPS)
    return section
  })
  return normalizePattern({
    ...sections[0],
    sections,
    active: 0,
    order: Array.from({ length: bars }, (_, i) => i),
    bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)),
    swing,
  })
}
