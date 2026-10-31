// More styles for the Beats tool: East African sounds first, then the global styles producers expect.
// This file is plain data. presets.js turns each entry into a full preset with its preset() builder,
// so the rules there still apply:
//   - drum rows are 16 characters (x = hit, . = rest), "-" clears a lane
//   - melody and bass are 16 scale degrees (0 = root, up to 7), "." is a rest
//   - sections B, C and D take anything left out from section A
// Each entry is [id, name, settings].

const SONG = 'A A A D B B B D'

export const WORLD_SPECS = [
  // ---- East Africa ----
  [
    'bongo-flava',
    'Bongo Flava',
    {
      bpm: 100,
      swing: 0.1,
      key: 9,
      scale: 'minor-pentatonic',
      sound: 'keys',
      bassSound: 'bass',
      order: SONG,
      A: {
        drums: {
          kick: 'x..x..x...x...x.',
          snare: '....x.......x...',
          hat: 'x.x.x.x.x.x.x.x.',
          shaker: '.x.x.x.x.x.x.x.x',
          rim: '..x...x...x...x.',
        },
        bass: '0 . . 0 . . 2 . . . 3 . . 2 . .',
        melody: '4 . . 2 . 3 . . 4 . . 2 . 0 . .',
      },
      B: {
        drums: { clap: '....x.......x...', openHat: '......x.......x.', hat: 'x.xxx.xxx.xxx.xx' },
        bass: '0 . . 0 . 2 . . 0 . 3 . . 2 . 3',
        melody: '4 . 5 . 4 . 2 . 3 . . 2 0 . 2 .',
      },
    },
  ],

  [
    'kidandali',
    'Kidandali',
    {
      bpm: 118,
      swing: 0.08,
      key: 2,
      scale: 'major',
      sound: 'keys',
      bassSound: 'bass',
      order: SONG,
      A: {
        drums: {
          kick: 'x...x...x...x...',
          snare: '....x.......x...',
          hat: '..x...x...x...x.',
          shaker: '.x.x.x.x.x.x.x.x',
          conga: '..x..x..x..x..x.',
        },
        bass: '0 . 0 . . 0 . . 3 . 3 . . 4 . .',
        melody: '2 . 4 . 5 . 4 . 2 . 4 . 2 . . .',
      },
      B: {
        drums: { hat: 'x.x.x.x.x.x.x.x.', openHat: '..x...x...x...x.', cowbell: '.x...x...x...x..' },
        bass: '0 . 0 . 3 . . 3 4 . . 4 3 . 2 .',
        melody: '4 . 5 . 6 . 5 . 4 . 2 . 4 . . .',
      },
    },
  ],

  [
    'kadongo-kamu',
    'Kadongo Kamu',
    {
      bpm: 92,
      swing: 0.1,
      key: 7,
      scale: 'major',
      sound: 'pluck',
      bassSound: 'bass',
      order: 'A A B A A B C D',
      A: {
        drums: {
          kick: 'x.......x.x.....',
          rim: '....x.......x...',
          shaker: '.x.x.x.x.x.x.x.x',
        },
        bass: '0 . . . 2 . . . 3 . . . 2 . . .',
        melody: '2 . 4 . 5 . 4 . 2 . . . 0 . 2 .',
      },
      B: {
        drums: { conga: '..x..x..x..x..x.', hat: 'x.x.x.x.x.x.x.x.' },
        bass: '0 . . 0 . . 2 . 3 . . 3 . . 2 .',
        melody: '4 . 5 . 7 . 5 . 4 . 2 . 4 . . .',
      },
    },
  ],

  // ---- Africa and the diaspora ----
  [
    'afro-swing',
    'Afro-swing',
    {
      bpm: 100,
      swing: 0.15,
      key: 0,
      scale: 'natural-minor',
      sound: 'keys',
      bassSound: '808',
      order: SONG,
      A: {
        drums: {
          kick: 'x..x....x.x.....',
          clap: '....x.......x...',
          hat: 'x.xxx.xxx.xxx.xx',
          openHat: '......x.......x.',
          shaker: '.x.x.x.x.x.x.x.x',
        },
        bass: '0 . . . . 0 . . 3 . . . 2 . . .',
        melody: '4 . . 2 . . 3 . 4 . . . 2 . 0 .',
      },
      B: {
        drums: { perc: '..x..x..x..x..x.', cowbell: '.x...x...x...x..' },
        bass: '0 . . 0 . . 0 . 3 . . 3 . . 2 .',
        melody: '4 . 5 . 4 . 2 . 4 . 3 . 2 . 0 .',
      },
    },
  ],

  [
    'classic-afrobeat',
    'Classic Afrobeat',
    {
      bpm: 108,
      swing: 0.1,
      key: 7,
      scale: 'minor-pentatonic',
      sound: 'keys',
      bassSound: 'bass',
      order: 'A A A D B B C D',
      A: {
        drums: {
          kick: 'x.....x..x.x....',
          snare: '....x..x....x...',
          hat: 'x.x.x.x.x.x.x.x.',
          shaker: '.x.x.x.x.x.x.x.x',
          cowbell: 'x..x..x...x.x...',
          conga: '..x..x..x..x..x.',
          rim: '.x..x..x.x..x...',
        },
        bass: '0 . . 0 . 2 . . 3 . . 2 . 0 . .',
        melody: '4 . 4 . . 2 . 3 . . 4 . 5 . 4 .',
      },
      B: {
        drums: { clap: '....x.......x...', openHat: '..x...x...x...x.' },
        bass: '0 . 0 . 2 . . 3 . . 2 . 0 . . 0',
        melody: '5 . 4 . 2 . 3 . 4 . . 2 0 . 2 .',
      },
    },
  ],

  [
    'gqom',
    'Gqom',
    {
      bpm: 124,
      key: 5,
      scale: 'natural-minor',
      sound: 'pluck',
      bassSound: 'sub',
      order: SONG,
      A: {
        drums: {
          kick: 'x..x..x.x..x..x.',
          snare: '........x.......',
          hat: '..x...x...x...x.',
          rim: '.x..x..x.x..x...',
        },
        bass: '0 . . 0 . . 0 . . . 1 . . . . .',
        melody: '. . . . 3 . . . . . . . 2 . . .',
      },
      B: {
        drums: { clap: '........x.......', openHat: '......x.......x.', perc: '..x...x...x...x.' },
        bass: '0 . . 0 . . 0 . . 0 . 1 . . . .',
        melody: '. . 3 . . . 4 . . . 3 . . . 1 .',
      },
    },
  ],

  // ---- Hip-hop and Latin ----
  [
    'uk-drill',
    'UK Drill',
    {
      bpm: 140,
      key: 0,
      scale: 'natural-minor',
      sound: 'bell',
      bassSound: '808',
      order: SONG,
      A: {
        drums: {
          kick: 'x.....x..x....x.',
          snare: '........x.......',
          hat: 'x.x.xxx.x.x.xxx.',
          openHat: '.......x.......x',
        },
        bass: '0 . . . . . 0 . . 0 . . . . 2 .',
        melody: '4 . . . 3 . . . . . 2 . . . . .',
      },
      B: {
        drums: { hat: 'x.xxxxx.x.xxxxx.', perc: '..x.....x.....x.' },
        bass: '0 . . . . . 0 . . 0 . . 2 . 0 .',
        melody: '4 . . 5 . . 4 . 3 . . . 2 . . .',
      },
    },
  ],

  [
    'reggaeton',
    'Reggaeton',
    {
      bpm: 94,
      swing: 0.05,
      key: 9,
      scale: 'natural-minor',
      sound: 'pluck',
      bassSound: 'bass',
      order: SONG,
      A: {
        drums: {
          kick: 'x...x...x...x...',
          snare: '...x..x....x..x.',
          hat: 'x.x.x.x.x.x.x.x.',
          conga: '.x..x..x.x..x...',
        },
        bass: '0 . . 0 . . 2 . 0 . . 0 . . 3 .',
        melody: '4 . . 4 . . 2 . . . 3 . . . 2 .',
      },
      B: {
        drums: { openHat: '..x...x...x...x.', cowbell: '.x...x...x...x..' },
        bass: '0 . . 0 . . 2 . 0 . 2 . 0 . 3 .',
        melody: '4 . 5 . 4 . . 2 3 . . 4 . 2 . .',
      },
    },
  ],

  // ---- Club and dance ----
  [
    'drum-and-bass',
    'Drum & bass',
    {
      bpm: 174,
      key: 9,
      scale: 'natural-minor',
      sound: 'pad',
      bassSound: 'sub',
      order: SONG,
      A: {
        drums: {
          kick: 'x.........x.....',
          snare: '....x.......x...',
          hat: 'x.x.x.x.x.x.x.x.',
        },
        bass: '0 . . . . . . 0 . . 3 . . . 2 .',
        melody: '4 . . . . . . . 2 . . . . . . .',
      },
      B: {
        drums: { kick: 'x.........xx....', openHat: '..x...x...x...x.' },
        bass: '0 . . . . . 0 . 0 . . 3 . . 2 .',
        melody: '4 . . . 5 . . . 4 . . . 2 . . .',
      },
    },
  ],

  [
    'uk-garage',
    'UK Garage',
    {
      bpm: 132,
      swing: 0.3,
      key: 7,
      scale: 'natural-minor',
      sound: 'keys',
      bassSound: 'sub',
      order: SONG,
      A: {
        drums: {
          kick: 'x.........x..x..',
          clap: '....x.......x...',
          hat: 'x.x.x.x.x.x.x.x.',
          shaker: '.x.x.x.x.x.x.x.x',
        },
        bass: '0 . . . . 0 . . . . 3 . . . . .',
        melody: '4 . . 2 . . 4 . . 3 . . 2 . . .',
      },
      B: {
        drums: { perc: '.x..x..x.x..x...', openHat: '......x.......x.' },
        bass: '0 . . . . 0 . . . 0 . . 3 . . 2',
        melody: '4 . 5 . . 4 . . 2 . 3 . . . . .',
      },
    },
  ],

  [
    'techno',
    'Techno',
    {
      bpm: 130,
      key: 5,
      scale: 'natural-minor',
      sound: 'pluck',
      bassSound: 'sub',
      order: 'A A A D B B B D',
      A: {
        drums: {
          kick: 'x...x...x...x...',
          clap: '....x.......x...',
          hat: 'x.x.x.x.x.x.x.x.',
          openHat: '..x...x...x...x.',
          rim: '.x..x..x.x..x...',
        },
        bass: '. . 0 . . . 0 . . . 0 . . . 0 .',
        melody: '0 . . . . . 3 . . . . . 2 . . .',
      },
      B: {
        drums: { perc: '...x.x.....x.x..' },
        bass: '. . 0 . . 0 0 . . . 0 . . 0 2 .',
        melody: '0 . . 3 . . 4 . . . 3 . . 2 . .',
      },
    },
  ],

  [
    'disco-funk',
    'Disco funk',
    {
      bpm: 116,
      key: 0,
      scale: 'major',
      sound: 'keys',
      bassSound: 'bass',
      order: SONG,
      A: {
        drums: {
          kick: 'x...x...x...x...',
          clap: '....x.......x...',
          hat: 'x.x.x.x.x.x.x.x.',
          openHat: '..x...x...x...x.',
        },
        bass: '0 . 0 . 4 . 0 . 4 . 0 . 4 . 3 .',
        melody: '4 . 5 . . 4 . 2 . 4 . . 5 . 4 .',
      },
      B: {
        drums: { shaker: '.x.x.x.x.x.x.x.x', cowbell: '.x...x...x...x..' },
        bass: '0 . 0 4 . 0 . 4 . 0 . 4 . 3 . 4',
        melody: '5 . 6 . 7 . 6 . 5 . 4 . 2 . . 4',
      },
    },
  ],
]
