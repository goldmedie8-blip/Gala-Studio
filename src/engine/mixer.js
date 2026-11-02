// The mixer: one channel strip per track, a reverb everyone can send to, and a master. It is built on any
// audio context, so the same mixer plays live and renders the exported song.
//
// Signal path of a track:
//   clips -> de-esser -> compressor -> low EQ -> mid EQ -> high EQ -> pan -> volume -> master
//                                                                              |-> reverb send -> reverb -> master
//                                                                              |-> echo send -> echo -> master
//                                                                              \-> doubler (two short delays, left and right) -> master
// The level meter listens after the volume, so it shows what you hear.
//
// The master path is:  all tracks -> glue compressor -> make-up gain -> limiter -> ceiling -> speakers.
// With mastering Off it behaves like the gentle compressor Gala always had.
import { levelFromTimeDomain } from './level.js'
import { EQ_RANGE, trackGain } from './timeline.js'
import { DEESS_SPLIT_HZ, DOUBLE_DELAYS, ceilingCurve, compressorSettings, deEsserSettings, delaySeconds, masteringSettings } from './effects.js'

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

const ECHO_FEEDBACK = 0.38
const DOUBLE_LEVEL = 0.6

function createStrip(ctx, track, master, reverb) {
  const input = ctx.createGain()
  // De-esser: split the voice into low and high parts, squeeze only the high part, and put them back.
  // The high part is turned upside down before adding, which makes the two parts add up flat.
  const sLow = ctx.createBiquadFilter()
  sLow.type = 'lowpass'
  sLow.frequency.setValueAtTime(DEESS_SPLIT_HZ, 0)
  sLow.Q.setValueAtTime(0.7071, 0)
  const sHigh = ctx.createBiquadFilter()
  sHigh.type = 'highpass'
  sHigh.frequency.setValueAtTime(DEESS_SPLIT_HZ, 0)
  sHigh.Q.setValueAtTime(0.7071, 0)
  const sComp = ctx.createDynamicsCompressor()
  const sFlip = ctx.createGain()
  sFlip.gain.value = -1
  const sSum = ctx.createGain()
  input.connect(sLow)
  input.connect(sHigh)
  sLow.connect(sSum)
  sHigh.connect(sComp)
  sComp.connect(sFlip)
  sFlip.connect(sSum)
  const comp = ctx.createDynamicsCompressor()
  const makeup = ctx.createGain()
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

  let last = sSum
  for (const node of [comp, makeup, ...bands.map((b) => b.filter), ...(panner ? [panner] : [])]) {
    last.connect(node)
    last = node
  }
  last.connect(fader)
  fader.connect(master)
  fader.connect(meter)
  fader.connect(send)
  send.connect(reverb)

  // Echo: a delay that feeds back on itself a little, getting darker each time round.
  const echoSend = ctx.createGain()
  const echo = ctx.createDelay(2)
  const echoFeedback = ctx.createGain()
  const echoTone = ctx.createBiquadFilter()
  echoTone.type = 'lowpass'
  echoTone.frequency.setValueAtTime(3200, 0)
  echoFeedback.gain.value = ECHO_FEEDBACK
  fader.connect(echoSend)
  echoSend.connect(echo)
  echo.connect(echoTone)
  echoTone.connect(echoFeedback)
  echoFeedback.connect(echo)
  echoTone.connect(master)

  // Doubler: two tiny delays, one in each ear, so one voice sounds like two.
  const doubleSend = ctx.createGain()
  const doubles = DOUBLE_DELAYS.map((time, i) => {
    const delay = ctx.createDelay(0.1)
    delay.delayTime.value = time
    const side = ctx.createStereoPanner?.() ?? null
    if (side) side.pan.value = i === 0 ? -1 : 1
    doubleSend.connect(delay)
    if (side) {
      delay.connect(side)
      side.connect(master)
    } else {
      delay.connect(master)
    }
    return { delay, side }
  })
  fader.connect(doubleSend)

  return { id: track.id, input, bands, panner, fader, send, meter, softS: sComp, comp, makeup, echoSend, echo, doubleSend, doubles, samples: new Float32Array(meter.fftSize) }
}

export function createMixer(ctx) {
  const masterGain = ctx.createGain()
  const masterMeter = ctx.createAnalyser()
  masterMeter.fftSize = 1024
  const glue = ctx.createDynamicsCompressor()
  const masterMakeup = ctx.createGain()
  const limiter = ctx.createDynamicsCompressor()
  const ceiling = ctx.createWaveShaper()
  masterGain.connect(glue)
  glue.connect(masterMakeup)
  masterMakeup.connect(limiter)
  limiter.connect(ceiling)
  ceiling.connect(ctx.destination)
  ceiling.connect(masterMeter)
  let lastCeiling = null

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
        strip.echoSend.disconnect()
        strip.doubleSend.disconnect()
        strips.delete(id)
      }
    }
    masterGain.gain.value = timeline.masterVolume
    const m = masteringSettings(timeline.master)
    glue.threshold.value = m.comp.threshold
    glue.ratio.value = m.comp.ratio
    glue.knee.value = 10
    masterMakeup.gain.value = m.makeupGain
    limiter.threshold.value = m.limiter.threshold
    limiter.ratio.value = m.limiter.ratio
    limiter.knee.value = 0
    limiter.attack.value = 0.002
    limiter.release.value = 0.1
    if (lastCeiling !== m.ceilingGain) {
      ceiling.curve = ceilingCurve(m.ceilingGain)
      lastCeiling = m.ceilingGain
    }
    for (const track of timeline.tracks) {
      const strip = strips.get(track.id)
      strip.fader.gain.value = trackGain(timeline, track)
      if (strip.panner) strip.panner.pan.value = track.pan
      for (const { id, filter } of strip.bands) filter.gain.value = Math.max(-EQ_RANGE, Math.min(EQ_RANGE, track.eq[id]))
      strip.send.gain.value = track.reverb
      const d = deEsserSettings(track.softS)
      strip.softS.threshold.value = d.threshold
      strip.softS.ratio.value = d.ratio
      strip.softS.knee.value = d.knee
      strip.softS.attack.value = d.attack
      strip.softS.release.value = d.release
      const c = compressorSettings(track.comp)
      strip.comp.threshold.value = c.threshold
      strip.comp.ratio.value = c.ratio
      strip.comp.knee.value = c.knee
      strip.comp.attack.value = c.attack
      strip.comp.release.value = c.release
      strip.makeup.gain.value = c.makeup
      strip.echoSend.gain.value = track.delay
      strip.echo.delayTime.value = delaySeconds(timeline.bpm, track.delayTime)
      strip.doubleSend.gain.value = track.double * DOUBLE_LEVEL
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

  // How much the limiter is turning the song down right now, in dB (0 when it is not working).
  function reduction() {
    const r = limiter.reduction
    return Math.abs(typeof r === 'number' ? r : (r?.value ?? 0))
  }

  function dispose() {
    for (const strip of strips.values()) {
      strip.fader.disconnect()
      strip.send.disconnect()
      strip.echoSend.disconnect()
      strip.doubleSend.disconnect()
    }
    strips.clear()
    masterGain.disconnect()
    ceiling.disconnect()
    clickBus.disconnect()
  }

  return { ctx, update, levels, reduction, dispose, strip: (id) => strips.get(id), clickBus, masterGain }
}
