// The piano and other keyboard sounds, synthesised with the Web Audio API (no sample files, so they work
// offline and render into exported songs). A voice is started with createVoice and ended with release().
import { midiToFrequency } from './scale.js'

export const LOWEST_NOTE = 21 // A0
export const HIGHEST_NOTE = 108 // C8

export const SOUNDS = [
  { id: 'piano', name: 'Piano' },
  { id: 'keys', name: 'Electric keys' },
  { id: 'pad', name: 'Soft pad' },
]
export const getSound = (id) => SOUNDS.find((s) => s.id === id) ?? SOUNDS[0]

const RELEASE = 0.22

// Each sound is a few oscillators (ratio to the note, wave, loudness), a filter and an envelope.
const RECIPES = {
  piano: {
    parts: [
      { ratio: 1, type: 'triangle', level: 1 },
      { ratio: 2, type: 'sine', level: 0.32 },
      { ratio: 3, type: 'sine', level: 0.12 },
    ],
    filter: { open: 7, close: 1.6, time: 0.9 },
    attack: 0.004,
    sustain: 0.0001, // a piano string fades away even when the key is held
    decay: 2.4,
    peak: 0.5,
  },
  keys: {
    parts: [
      { ratio: 1, type: 'sine', level: 1 },
      { ratio: 2, type: 'sine', level: 0.28 },
      { ratio: 7, type: 'sine', level: 0.05 },
    ],
    filter: { open: 9, close: 5, time: 0.3 },
    attack: 0.006,
    sustain: 0.22,
    decay: 0.9,
    peak: 0.5,
  },
  pad: {
    parts: [
      { ratio: 1, type: 'sawtooth', level: 0.5, detune: -7 },
      { ratio: 1, type: 'sawtooth', level: 0.5, detune: 7 },
    ],
    filter: { open: 3, close: 2, time: 0.6 },
    attack: 0.09,
    sustain: 0.6,
    decay: 0.5,
    peak: 0.32,
  },
}

export const clampNote = (midi) => Math.min(HIGHEST_NOTE, Math.max(LOWEST_NOTE, Math.round(Number(midi) || 60)))

// Starts a note at `time`. Call release(time) to end it. Quiet and loud presses (velocity 0 to 1) differ.
export function createVoice(ctx, dest, midi, time, { velocity = 0.8, sound = 'piano' } = {}) {
  const recipe = RECIPES[getSound(sound).id]
  const note = clampNote(midi)
  const freq = midiToFrequency(note)
  const peak = recipe.peak * (0.25 + 0.75 * Math.min(1, Math.max(0.05, velocity)))

  const release = ctx.createGain()
  release.gain.setValueAtTime(1, time)
  release.connect(dest)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, time)
  env.gain.linearRampToValueAtTime(peak, time + recipe.attack)
  env.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * recipe.sustain), time + recipe.attack + recipe.decay)
  env.connect(release)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  const open = Math.min(16000, freq * recipe.filter.open * (0.6 + velocity))
  const close = Math.min(16000, freq * recipe.filter.close)
  filter.frequency.setValueAtTime(open, time)
  filter.frequency.exponentialRampToValueAtTime(Math.max(200, close), time + recipe.filter.time)
  filter.connect(env)

  const oscillators = recipe.parts.map((part) => {
    const osc = ctx.createOscillator()
    osc.type = part.type
    osc.frequency.setValueAtTime(freq * part.ratio, time)
    if (part.detune && osc.detune) osc.detune.setValueAtTime(part.detune, time)
    const level = ctx.createGain()
    level.gain.setValueAtTime(part.level, time)
    osc.connect(level)
    level.connect(filter)
    osc.start(time)
    return osc
  })

  let ended = false
  return {
    release(at = ctx.currentTime) {
      if (ended) return
      ended = true
      const when = Math.max(at, time + recipe.attack)
      release.gain.setValueAtTime(1, when)
      release.gain.linearRampToValueAtTime(0, when + RELEASE)
      for (const osc of oscillators) osc.stop(when + RELEASE + 0.02)
    },
  }
}

// A note with a known length, for playing back a recorded part.
export function playNote(ctx, dest, midi, time, { duration = 0.5, velocity = 0.8, sound = 'piano' } = {}) {
  const voice = createVoice(ctx, dest, midi, time, { velocity, sound })
  voice.release(time + Math.max(0.05, duration))
}

// ---- keys, names, chords ---------------------------------------------------------------------------------

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteLabel = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
export const isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(midi % 12)

export const CHORDS = {
  single: { name: 'Single notes', intervals: [0] },
  major: { name: 'Major chord', intervals: [0, 4, 7] },
  minor: { name: 'Minor chord', intervals: [0, 3, 7] },
  seventh: { name: 'Seventh chord', intervals: [0, 4, 7, 10] },
  minor7: { name: 'Minor seventh', intervals: [0, 3, 7, 10] },
}
export const chordNotes = (midi, chord = 'single') => (CHORDS[chord] ?? CHORDS.single).intervals.map((i) => clampNote(midi + i))

// Computer keyboard layout: the middle letter row are the white keys, the row above them the black keys.
export const COMPUTER_KEYS = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16,
}
