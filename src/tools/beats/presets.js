// Starter beats so a beginner hears something good in one tap. Each style comes with four sections:
//   A Groove (the main loop), B Hook (fuller, for the chorus), C Break (drums drop out) and D Fill (a
//   drum roll into the next part), plus an arrangement that plays them in order. They are starting
//   points, not rules: change any step.
//
// Drum rows are 16 characters (x = hit, . = rest). Melody and bass are 16 scale degrees (0 is the root of
// the key, higher climbs the scale), "." is a rest. In sections B to D anything left out is taken from
// section A, and "-" clears it.
import { DRUM_LANES, SECTION_COUNT, STEPS, emptyPattern, normalizePattern } from '../../engine/pattern.js'
import { WORLD_SPECS } from './presets.world.js'

const LANE_IDS = DRUM_LANES.map((lane) => lane.id)
const LETTERS = ['A', 'B', 'C', 'D']

const clearedDrums = '-'
const clearedNotes = Array(STEPS).fill('.').join(' ')

function check(id, what, count) {
  if (count !== STEPS) throw new Error(`Preset "${id}": ${what} has ${count} steps, it needs ${STEPS}`)
}

const hits = (id, lane, text) => {
  const row = text === clearedDrums ? '.'.repeat(STEPS) : text
  check(id, `${lane} row`, row.length)
  return [...row].map((c) => c === 'x')
}

const notes = (id, what, text) => {
  const row = text === '-' ? clearedNotes : text
  const parts = row.trim().split(/\s+/)
  check(id, what, parts.length)
  return parts.map((t) => (t === '.' ? null : Number(t)))
}

// Every section builds on A unless it says otherwise.
const merge = (spec, base) => ({
  drums: Object.fromEntries(LANE_IDS.map((lane) => [lane, spec.drums?.[lane] ?? base?.drums[lane] ?? clearedDrums])),
  melody: spec.melody ?? base?.melody ?? '-',
  bass: spec.bass ?? base?.bass ?? '-',
})

const toData = (id, section) => ({
  drums: Object.fromEntries(LANE_IDS.map((lane) => [lane, hits(id, lane, section.drums[lane])])),
  melody: notes(id, 'melody', section.melody),
  bass: notes(id, 'bass', section.bass),
})

// The same shape of break and fill suits every style, so they are shared. A style can override either.
const BREAK = {
  drums: { kick: 'x...............', snare: '-', clap: '-', hat: '-', openHat: '-', perc: '-', rim: '-', conga: '-', cowbell: '-' },
  bass: '-',
}
const FILL = {
  drums: { kick: 'x.......x.......', snare: '........x.x.xxxx', clap: '-', hat: '-', openHat: '-' },
  melody: '-',
  bass: '-',
}

function preset(id, name, { bpm, swing = 0, key, scale, sound, bassSound, order, A, B, C = {}, D = {} }) {
  const a = merge(A)
  const sections = [a, merge(B, a), merge({ ...BREAK, ...C, drums: { ...BREAK.drums, ...C.drums } }, a), merge({ ...FILL, ...D, drums: { ...FILL.drums, ...D.drums } }, a)]
  const data = sections.map((section) => toData(id, section))
  const bars = order.trim().split(/\s+/).map((letter) => LETTERS.indexOf(letter))
  if (bars.some((i) => i < 0) || data.length !== SECTION_COUNT) throw new Error(`Preset "${id}": bad arrangement`)
  const pattern = normalizePattern({
    ...emptyPattern(),
    ...data[0],
    sections: data,
    active: 0,
    order: bars,
    bpm,
    swing,
    key,
    scale,
    sound,
    bassSound,
  })
  return { id, name, pattern }
}

const SONG = 'A A A D B B B D'

export const PRESETS = [
  preset('afrobeat', 'Afrobeats', {
    bpm: 102,
    swing: 0.12,
    key: 9,
    scale: 'minor-pentatonic',
    sound: 'pluck',
    bassSound: 'bass',
    order: SONG,
    A: {
      drums: {
        kick: 'x..x..x...x.....',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        openHat: '......x.......x.',
        shaker: '.x.x.x.x.x.x.x.x',
        conga: '..x..x..x..x..x.',
      },
      bass: '0 . . 0 . . 2 . . . 3 . . . . .',
      melody: '4 . . . 2 . 3 . . 2 . . 0 . 2 .',
    },
    B: {
      drums: { clap: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', cowbell: '..x...x...x...x.' },
      bass: '0 . . 0 . . 2 . 0 . 3 . . 2 . .',
      melody: '4 . 5 . 4 . 2 . 3 . . 2 0 . 2 .',
    },
  }),

  preset('amapiano', 'Amapiano', {
    bpm: 112,
    swing: 0.05,
    key: 7,
    scale: 'minor-pentatonic',
    sound: 'keys',
    bassSound: '808',
    order: SONG,
    A: {
      drums: {
        kick: 'x...x...x...x...',
        clap: '....x.......x...',
        hat: '..x...x...x...x.',
        shaker: '.x.x.x.x.x.x.x.x',
        conga: '..x..x..x..x..x.',
      },
      bass: '0 . . 0 . . 3 . . . 0 . . 2 . .',
      melody: '. . 4 . . . 2 . . . 3 . . . 2 .',
    },
    B: {
      drums: { hat: 'x.x.x.x.x.x.x.x.', openHat: '..x...x...x...x.', cowbell: '.x...x...x...x..' },
      bass: '0 . 0 . . 0 . 3 . . 0 . 2 . 3 .',
      melody: '4 . 3 . 2 . . . 4 . 3 . 5 . . .',
    },
  }),

  preset('afro-fusion', 'Afro-fusion', {
    bpm: 96,
    swing: 0.2,
    key: 2,
    scale: 'natural-minor',
    sound: 'keys',
    bassSound: 'sub',
    order: 'A A A D B B C D',
    A: {
      drums: {
        kick: 'x.....x..x......',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        rim: '..x.....x...x...',
        shaker: '.x.x.x.x.x.x.x.x',
      },
      bass: '0 . . . . . 0 . . 3 . . . . . .',
      melody: '. . 4 . . . 2 . . . 0 . 2 . . .',
    },
    B: {
      drums: { clap: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', conga: '..x..x..x..x..x.' },
      bass: '0 . . 0 . . 0 . . 3 . . 2 . . .',
      melody: '4 . . 5 . . 4 . 2 . . 3 . . 2 .',
    },
  }),

  preset('afro-house', 'Afro house', {
    bpm: 122,
    key: 5,
    scale: 'minor-pentatonic',
    sound: 'pluck',
    bassSound: 'bass',
    order: SONG,
    A: {
      drums: {
        kick: 'x...x...x...x...',
        clap: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        openHat: '..x...x...x...x.',
        shaker: 'xxxxxxxxxxxxxxxx',
        conga: '..x..x..x..x..x.',
      },
      bass: '. . 0 . . . 0 . . . 0 . . . 3 .',
      melody: '4 . . 2 . . 4 . . . 5 . . 3 . .',
    },
    B: {
      drums: { cowbell: '..x...x...x...x.', rim: '.x..x..x.x..x...' },
      bass: '. . 0 . . 0 0 . . . 0 . . 0 2 .',
      melody: '4 . 5 . 4 . 2 . 4 . 5 . 7 . 5 .',
    },
  }),

  preset('dancehall', 'Dancehall', {
    bpm: 98,
    swing: 0.1,
    key: 0,
    scale: 'natural-minor',
    sound: 'keys',
    bassSound: '808',
    order: SONG,
    A: {
      drums: {
        kick: 'x...x...x...x...',
        snare: '...x..x....x..x.',
        hat: 'x.x.x.x.x.x.x.x.',
        openHat: '.......x.......x',
      },
      bass: '0 . . . 0 . . . 3 . . . 2 . . .',
      melody: '. . 4 . . . . 4 . . 2 . . . 0 .',
    },
    B: {
      drums: { perc: '..x..x..x..x..x.', cowbell: '.x...x...x...x..' },
      melody: '4 . 4 . 2 . 3 . 4 . 4 . 2 . 0 .',
      bass: '0 . . 0 . . 0 . 3 . . 3 . . 2 .',
    },
  }),

  preset('reggae', 'Reggae', {
    bpm: 76,
    swing: 0.1,
    key: 7,
    scale: 'minor-pentatonic',
    sound: 'keys',
    bassSound: 'sub',
    order: SONG,
    A: {
      drums: {
        kick: '........x.......',
        snare: '........x.......',
        hat: 'x.x.x.x.x.x.x.x.',
        rim: '....x.......x...',
      },
      bass: '0 . . . . . 2 . 3 . . . 2 . . 0',
      melody: '. . 3 . . . 3 . . . 3 . . . 3 .',
    },
    B: {
      drums: { conga: '..x.....x...x...', shaker: '.x.x.x.x.x.x.x.x' },
      melody: '. . 4 . . . 4 . . . 3 . . . 2 .',
      bass: '0 . . 0 . . 2 . 3 . . 3 . . 2 0',
    },
  }),

  preset('trap', 'Trap', {
    bpm: 140,
    key: 0,
    scale: 'natural-minor',
    sound: 'bell',
    bassSound: '808',
    order: SONG,
    A: {
      drums: {
        kick: 'x.....x...x.....',
        snare: '........x.......',
        clap: '........x.......',
        hat: 'x.x.x.xxx.x.x.xx',
        openHat: '......x.......x.',
      },
      bass: '0 . . . . . 0 . . . 2 . . . . .',
      melody: '4 . . . . . . 2 . . . . 3 . . .',
    },
    B: {
      drums: { hat: 'x.x.xxxxx.x.xxxx', perc: '..x.....x.....x.' },
      bass: '0 . . . . . 0 . 0 . 2 . . . 3 .',
      melody: '4 . 5 . . . 4 . . 2 . . 3 . 2 .',
    },
  }),

  preset('boom-bap', 'Boom bap', {
    bpm: 90,
    swing: 0.3,
    key: 2,
    scale: 'minor-pentatonic',
    sound: 'keys',
    bassSound: 'bass',
    order: SONG,
    A: {
      drums: {
        kick: 'x..x....x.x.....',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
      },
      bass: '0 . . 0 . . . . 2 . 3 . . . . .',
      melody: '0 . . . 2 . . . 3 . . . 2 . . .',
    },
    B: {
      drums: { openHat: '......x.......x.', rim: '..x.....x.......' },
      melody: '4 . . 3 . . 2 . 4 . . 3 . . 0 .',
      bass: '0 . . 0 . . 2 . 2 . 3 . . 0 . .',
    },
  }),

  preset('lofi', 'Lo-fi', {
    bpm: 78,
    swing: 0.35,
    key: 0,
    scale: 'natural-minor',
    sound: 'keys',
    bassSound: 'sub',
    order: SONG,
    A: {
      drums: {
        kick: 'x..x....x.x.....',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        shaker: '.x...x...x...x..',
      },
      bass: '0 . . . . . . . 3 . . . 2 . . .',
      melody: '4 . . . 2 . . . . . 3 . . . 0 .',
    },
    B: {
      drums: { openHat: '......x.......x.', rim: '..x.....x.......' },
      melody: '4 . 3 . 2 . . . 5 . 4 . 3 . . .',
      bass: '0 . . . . . 0 . 3 . . . 2 . . 3',
    },
  }),

  preset('rnb', 'R&B slow jam', {
    bpm: 68,
    swing: 0.25,
    key: 9,
    scale: 'natural-minor',
    sound: 'pad',
    bassSound: 'sub',
    order: 'A A A D B B C D',
    A: {
      drums: {
        kick: 'x.....x...x.....',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        rim: '..x.....x.....x.',
      },
      bass: '0 . . . . . 0 . . . 3 . . . . .',
      melody: '4 . . . . . . . 2 . . . . . . .',
    },
    B: {
      drums: { clap: '....x.......x...', shaker: '.x.x.x.x.x.x.x.x' },
      melody: '4 . . . 5 . . . 4 . . . 2 . . .',
      bass: '0 . . 0 . . 0 . . . 3 . . 2 . .',
    },
  }),

  preset('pop', 'Pop', {
    bpm: 118,
    key: 7,
    scale: 'major',
    sound: 'pluck',
    bassSound: 'bass',
    order: SONG,
    A: {
      drums: {
        kick: 'x...x...x...x...',
        snare: '....x.......x...',
        clap: '....x.......x...',
        hat: '..x...x...x...x.',
        openHat: '..x...x...x...x.',
      },
      bass: '0 . . 0 . . 0 . 3 . . 3 . . 4 .',
      melody: '2 . 4 . 2 . . . 4 . 5 . 4 . . .',
    },
    B: {
      drums: { hat: 'x.x.x.x.x.x.x.x.', shaker: '.x.x.x.x.x.x.x.x' },
      melody: '4 . 5 . 6 . 5 . 4 . 2 . 4 . . .',
      bass: '0 . 0 . 3 . 3 . 4 . 4 . 3 . 2 .',
    },
  }),

  preset('house', 'House', {
    bpm: 124,
    key: 9,
    scale: 'minor-pentatonic',
    sound: 'pluck',
    bassSound: 'bass',
    order: SONG,
    A: {
      drums: {
        kick: 'x...x...x...x...',
        clap: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        openHat: '..x...x...x...x.',
      },
      bass: '. . 0 . . . 0 . . . 0 . . . 3 .',
      melody: '4 . . 2 . . . . 4 . . 3 . . . .',
    },
    B: {
      drums: { shaker: '.x.x.x.x.x.x.x.x', perc: '.x..x..x.x..x...' },
      melody: '4 . 5 . . . 4 . 2 . 3 . 4 . . .',
      bass: '. . 0 . . 0 0 . . . 0 . 3 . 3 .',
    },
  }),

  preset('gospel', 'Gospel', {
    bpm: 84,
    swing: 0.15,
    key: 0,
    scale: 'major',
    sound: 'keys',
    bassSound: 'bass',
    order: SONG,
    A: {
      drums: {
        kick: 'x.....x...x.....',
        snare: '....x.......x...',
        clap: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        shaker: '.x.x.x.x.x.x.x.x',
      },
      bass: '0 . . . . . 0 . 3 . . . 4 . . .',
      melody: '2 . . . 4 . . . 5 . . . 4 . . .',
    },
    B: {
      drums: { openHat: '......x.......x.', conga: '..x..x..x..x..x.' },
      melody: '4 . 5 . 6 . 5 . 4 . 2 . 4 . . .',
      bass: '0 . . 0 . . 0 . 3 . . 3 . . 4 .',
    },
  }),
  ...WORLD_SPECS.map(([id, name, spec]) => preset(id, name, spec)),
]

export const getPreset = (id) => PRESETS.find((p) => p.id === id)
