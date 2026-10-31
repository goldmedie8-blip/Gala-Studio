// The mixer: one channel strip per track, a reverb everyone can send to, and a master. It is built on any
// audio context, so the same mixer plays live and renders the exported song.
//
// Signal path of a track:  clips -> low EQ -> mid EQ -> high EQ -> pan -> volume -> master
//                                                                              \-> reverb send -> reverb -> master
// The level meter listens after the volume, so it shows what you hear.
import { levelFromTimeDomain } from './level.js'
import { EQ_RANGE, trackGain } from './timeline.js'
import { createMaster } from './playback.js'

export const EQ_BANDS = [
  { id: 'low', name: 'Low', type: 'lowshelf', frequency: 200 },
  { id: 'mid', name: 'Mid', type: 'peaking', frequency: 1000, q: 0.9 },
  { id: 'high', name: 'High', type: 'highshelf', frequency: 4000 },
]

const REVERB_SECONDS = 1.8
const REVERB_RETURN = 0.55

// A made-up room: noise that fades away, different in each ear. No sample file needed.
export function createReverbImpulse(ctx, seconds = REVERB_SECONDS, decay = 3) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
  }
  return impulse
}

function createStrip(ctx, track, master, reverb) {
  const input = ctx.createGain()
  const bands = EQ_BANDS.map((band) => {
    const filter = ctx.createBiquadFilter()
    filter.type = band.type
    filter.frequency.setValueAtTime(band.frequency, 0)
    if (band.q) filter.Q.setValueAtTime(band.q, 0)
    return { id: band.id, filter }
  })
  const panner = ctx.createStereoPanner?.() ?? null
  const fader = ctx.createGain()
  const send = ctx.createGain()
  const meter = ctx.createAnalyser()
  meter.fftSize = 1024

  let last = input
  for (const { filter } of bands) {
    last.connect(filter)
    last = filter
  }
  if (panner) {
    last.connect(panner)
    last = panner
  }
  last.connect(fader)
  fader.connect(master)
  fader.connect(meter)
  fader.connect(send)
  send.connect(reverb)

  return { id: track.id, input, bands, panner, fader, send, meter, samples: new Float32Array(meter.fftSize) }
}

export function createMixer(ctx) {
  const out = createMaster(ctx) // gentle compressor so stacked tracks cannot clip the speakers
  const masterGain = ctx.createGain()
  const masterMeter = ctx.createAnalyser()
  masterMeter.fftSize = 1024
  masterGain.connect(out.input)
  masterGain.connect(masterMeter)

  const reverbIn = ctx.createGain()
  const convolver = ctx.createConvolver()
  convolver.buffer = createReverbImpulse(ctx)
  const reverbOut = ctx.createGain()
  reverbOut.gain.value = REVERB_RETURN
  reverbIn.connect(convolver)
  convolver.connect(reverbOut)
  reverbOut.connect(masterGain)

  // The metronome goes straight to the speakers, so it is never part of an exported song.
  const clickBus = ctx.createGain()
  clickBus.gain.value = 0.8
  clickBus.connect(ctx.destination)

  const strips = new Map()
  const masterSamples = new Float32Array(masterMeter.fftSize)

  // Makes the mixer match the timeline: adds new tracks, drops removed ones, sets every control.
  function update(timeline) {
    for (const track of timeline.tracks) {
      if (!strips.has(track.id)) strips.set(track.id, createStrip(ctx, track, masterGain, reverbIn))
    }
    for (const [id, strip] of strips) {
      if (!timeline.tracks.some((t) => t.id === id)) {
        strip.fader.disconnect()
        strip.send.disconnect()
        strips.delete(id)
      }
    }
    masterGain.gain.value = timeline.masterVolume
    for (const track of timeline.tracks) {
      const strip = strips.get(track.id)
      strip.fader.gain.value = trackGain(timeline, track)
      if (strip.panner) strip.panner.pan.value = track.pan
      for (const { id, filter } of strip.bands) filter.gain.value = Math.max(-EQ_RANGE, Math.min(EQ_RANGE, track.eq[id]))
      strip.send.gain.value = track.reverb
    }
  }

  // Meter readings from 0 to 1 for every track and the master.
  function levels() {
    const result = { master: { level: 0, clipping: false }, tracks: {} }
    masterMeter.getFloatTimeDomainData(masterSamples)
    result.master = levelFromTimeDomain(masterSamples)
    for (const [id, strip] of strips) {
      strip.meter.getFloatTimeDomainData(strip.samples)
      result.tracks[id] = levelFromTimeDomain(strip.samples)
    }
    return result
  }

  function dispose() {
    for (const strip of strips.values()) {
      strip.fader.disconnect()
      strip.send.disconnect()
    }
    strips.clear()
    masterGain.disconnect()
    clickBus.disconnect()
  }

  return { ctx, update, levels, dispose, strip: (id) => strips.get(id), clickBus, masterGain }
}
