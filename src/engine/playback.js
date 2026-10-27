import { DRUM_LANES } from './pattern.js'
import { degreeToMidi, midiToFrequency } from './scale.js'
import { stepSeconds } from './sequencer.js'
import { DRUMS, SOUNDS, synthNote } from './voices.js'

// Master output: a gentle compressor so stacked drums and bass cannot clip the speakers.
export function createMaster(ctx) {
  const input = ctx.createGain()
  input.gain.setValueAtTime(0.8, 0)
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.setValueAtTime(-12, 0)
  compressor.ratio.setValueAtTime(4, 0)
  input.connect(compressor)
  compressor.connect(ctx.destination)
  return { ctx, input }
}

export function playDrum(ctx, dest, laneId, time) {
  DRUMS[laneId](ctx, dest, time)
}

export function playNote(ctx, dest, pattern, degree, time, duration) {
  const midi = degreeToMidi({
    degree,
    key: pattern.key,
    scale: pattern.scale,
    octave: SOUNDS[pattern.sound].octave,
  })
  synthNote(ctx, dest, time, midiToFrequency(midi), duration, pattern.sound)
}

// Plays everything that is switched on at one step of the pattern.
export function playStep(ctx, dest, pattern, step, time) {
  for (const lane of DRUM_LANES) {
    if (pattern.drums[lane.id][step]) playDrum(ctx, dest, lane.id, time)
  }
  const degree = pattern.melody[step]
  if (degree !== null) playNote(ctx, dest, pattern, degree, time, stepSeconds(pattern.bpm) * 0.9)
}
