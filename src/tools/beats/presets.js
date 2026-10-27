// Starter patterns so a beginner hears something good in one tap. They are starting points, not rules:
// change any step. Drum rows are 16 characters (x = hit, . = rest). Melody numbers are scale degrees
// (0 is the root of the key, higher climbs the scale), "." is a rest.
import { emptyPattern, normalizePattern } from '../../engine/pattern.js'

const hits = (text) => [...text.replace(/\s+/g, '')].map((c) => c === 'x')
const notes = (text) => text.trim().split(/\s+/).map((t) => (t === '.' ? null : Number(t)))

function preset(id, name, { bpm, swing = 0, key, scale, sound, drums, melody }) {
  const base = emptyPattern()
  const pattern = normalizePattern({
    ...base,
    bpm,
    swing,
    key,
    scale,
    sound,
    drums: Object.fromEntries(Object.keys(base.drums).map((lane) => [lane, hits(drums[lane] ?? '................')])),
    melody: notes(melody),
  })
  return { id, name, pattern }
}

export const PRESETS = [
  preset('afrobeat', 'Afrobeat', {
    bpm: 102,
    swing: 0.15,
    key: 9,
    scale: 'minor-pentatonic',
    sound: 'keys',
    drums: {
      kick: 'x..x..x...x..x..',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      openHat: '......x.......x.',
      perc: '..x..x..x..x..x.',
    },
    melody: '0 . . 2 . . 3 . . 2 . . 4 . 3 .',
  }),
  preset('trap', 'Trap', {
    bpm: 140,
    key: 0,
    scale: 'natural-minor',
    sound: '808',
    drums: {
      kick: 'x.....x...x.....',
      snare: '........x.......',
      clap: '........x.......',
      hat: 'x.x.x.xxx.x.x.xx',
      openHat: '......x.......x.',
    },
    melody: '0 . . . . . 0 . . . 2 . . . . .',
  }),
  preset('boom-bap', 'Boom bap', {
    bpm: 90,
    swing: 0.3,
    key: 2,
    scale: 'minor-pentatonic',
    sound: 'keys',
    drums: {
      kick: 'x..x....x.x.....',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
    },
    melody: '0 . . . 2 . . . 3 . . . 2 . . .',
  }),
  preset('amapiano', 'Amapiano', {
    bpm: 112,
    key: 7,
    scale: 'minor-pentatonic',
    sound: 'bass',
    drums: {
      kick: 'x...x...x...x...',
      clap: '....x.......x...',
      hat: '..x...x...x...x.',
      openHat: 'x.......x.......',
      perc: '..x..x..x..x..x.',
    },
    melody: '0 . . . . . 3 . . . 0 . . 2 . .',
  }),
]

export const getPreset = (id) => PRESETS.find((p) => p.id === id)
