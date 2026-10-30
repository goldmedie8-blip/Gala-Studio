import { DRUM_LANES, locateStep } from './pattern.js'
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

// `track` is 'melody' or 'bass': each has its own sound.
export function playNote(ctx, dest, pattern, degree, time, duration, track = 'melody') {
  const soundId = track === 'bass' ? (pattern.bassSound ?? 'bass') : pattern.sound
  const sound = SOUNDS[soundId]
  const midi = degreeToMidi({ degree, key: pattern.key, scale: pattern.scale, octave: sound.octave })
  synthNote(ctx, dest, time, midiToFrequency(midi), duration * (sound.hold ?? 1), soundId)
}

// Plays everything that is switched on at one step. `step` counts from the start of the arrangement,
// so the bar and its section are worked out here.
export function playStep(ctx, dest, pattern, step, time) {
  const { section, local } = locateStep(pattern, step)
  for (const lane of DRUM_LANES) {
    if (section.drums[lane.id]?.[local]) playDrum(ctx, dest, lane.id, time)
  }
  const length = stepSeconds(pattern.bpm) * 0.9
  const degree = section.melody[local]
  if (degree !== null) playNote(ctx, dest, pattern, degree, time, length)
  const bass = section.bass?.[local]
  if (bass !== null && bass !== undefined) playNote(ctx, dest, pattern, bass, time, length, 'bass')
}
