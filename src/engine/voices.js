// Every sound Gala's beat maker makes is synthesised here with the Web Audio API.
// No sample files means a tiny download, instant start and full offline use.
// Each voice takes (ctx, destination, time) so it works live and when rendering to a file.

const noiseCache = new WeakMap()

function noiseBuffer(ctx) {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buffer)
  }
  return buffer
}

function noiseHit(ctx, dest, time, { type, frequency, q = 1, duration, gain }) {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(frequency, time)
  filter.Q.setValueAtTime(q, time)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(gain, time)
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  source.connect(filter)
  filter.connect(amp)
  amp.connect(dest)
  source.start(time)
  source.stop(time + duration + 0.02)
}

function toneHit(ctx, dest, time, { type = 'sine', from, to, drop, duration, gain }) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, time)
  osc.frequency.exponentialRampToValueAtTime(to, time + drop)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(gain, time)
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  osc.connect(amp)
  amp.connect(dest)
  osc.start(time)
  osc.stop(time + duration + 0.02)
}

export const DRUMS = {
  kick(ctx, dest, time) {
    toneHit(ctx, dest, time, { from: 160, to: 45, drop: 0.12, duration: 0.4, gain: 1 })
  },
  snare(ctx, dest, time) {
    noiseHit(ctx, dest, time, { type: 'highpass', frequency: 1800, duration: 0.2, gain: 0.55 })
    toneHit(ctx, dest, time, { type: 'triangle', from: 220, to: 160, drop: 0.08, duration: 0.12, gain: 0.5 })
  },
  clap(ctx, dest, time) {
    for (const offset of [0, 0.012, 0.024]) {
      noiseHit(ctx, dest, time + offset, { type: 'bandpass', frequency: 1500, q: 0.8, duration: 0.03, gain: 0.5 })
    }
    noiseHit(ctx, dest, time + 0.036, { type: 'bandpass', frequency: 1500, q: 0.8, duration: 0.16, gain: 0.5 })
  },
  hat(ctx, dest, time) {
    noiseHit(ctx, dest, time, { type: 'highpass', frequency: 7000, duration: 0.05, gain: 0.35 })
  },
  openHat(ctx, dest, time) {
    noiseHit(ctx, dest, time, { type: 'highpass', frequency: 7000, duration: 0.3, gain: 0.3 })
  },
  perc(ctx, dest, time) {
    toneHit(ctx, dest, time, { from: 900, to: 420, drop: 0.07, duration: 0.14, gain: 0.55 })
  },
}

// Melodic sounds. octave is the base octave of the bottom row of the melody grid.
export const SOUNDS = {
  bass: { name: 'Bass', octave: 2, type: 'sawtooth', cutoff: 700, attack: 0.008, release: 0.18, gain: 0.5 },
  '808': { name: '808 sub', octave: 1, type: 'sine', cutoff: 1200, attack: 0.004, release: 0.45, gain: 0.9, glide: 2 },
  keys: { name: 'Keys', octave: 4, type: 'triangle', cutoff: 3200, attack: 0.008, release: 0.35, gain: 0.45 },
  lead: { name: 'Lead', octave: 5, type: 'square', cutoff: 3800, attack: 0.01, release: 0.2, gain: 0.22 },
}

export function synthNote(ctx, dest, time, frequency, duration, soundId) {
  const sound = SOUNDS[soundId]
  const osc = ctx.createOscillator()
  osc.type = sound.type
  if (sound.glide) {
    osc.frequency.setValueAtTime(frequency * sound.glide, time)
    osc.frequency.exponentialRampToValueAtTime(frequency, time + 0.06)
  } else {
    osc.frequency.setValueAtTime(frequency, time)
  }
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(sound.cutoff, time)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, time)
  amp.gain.exponentialRampToValueAtTime(sound.gain, time + sound.attack)
  amp.gain.setValueAtTime(sound.gain, time + duration)
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration + sound.release)
  osc.connect(filter)
  filter.connect(amp)
  amp.connect(dest)
  osc.start(time)
  osc.stop(time + duration + sound.release + 0.05)
}
