// Keys, scales and note maths for the melody grid.
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const SCALES = {
  'minor-pentatonic': { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  'major-pentatonic': { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9] },
  'natural-minor': { name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  major: { name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
}

// Rows in the melody grid. Degree 0 is the root of the key, higher degrees climb the scale.
export const MELODY_ROWS = 8

export function degreeToMidi({ degree, key, scale, octave }) {
  const steps = SCALES[scale].steps
  const semitones = steps[degree % steps.length] + 12 * Math.floor(degree / steps.length)
  return 12 * (octave + 1) + key + semitones
}

export const midiToFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12)

export const noteName = (midi) => `${KEYS[midi % 12]}${Math.floor(midi / 12) - 1}`
