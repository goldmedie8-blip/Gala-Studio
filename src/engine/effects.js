// Settings for the vocal effects and the mastering chain, as plain data. The mixer turns them into audio.
const clamp = (v, min, max, fallback = min) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

// ---- vocal effects (per track) ------------------------------------------------------------------------

export const DELAY_TIMES = [
  { id: 'dotted', name: 'Dotted eighth', beats: 0.75 },
  { id: 'eighth', name: 'Eighth note', beats: 0.5 },
  { id: 'quarter', name: 'Quarter note', beats: 1 },
]
export const isDelayTime = (id) => DELAY_TIMES.some((d) => d.id === id)
export const delaySeconds = (bpm, id) => (60 / Math.max(30, bpm)) * (DELAY_TIMES.find((d) => d.id === id)?.beats ?? 0.75)

// One "amount" from 0 to 1 sets a compressor: more amount evens out loud and quiet words more, then
// brings the level back up so it does not sound quieter.
export function compressorSettings(amount) {
  const a = clamp(amount, 0, 1, 0)
  return { threshold: -4 - a * 28, ratio: 1 + a * 7, knee: 10, attack: 0.012, release: 0.18, makeup: 10 ** ((a * 5) / 20) }
}

// A de-esser squeezes only the bright top end of a voice (where "s" and "t" sounds hurt), and only when it
// gets loud, so the rest of the voice is untouched.
export const DEESS_SPLIT_HZ = 6000
export function deEsserSettings(amount) {
  const a = clamp(amount, 0, 1, 0)
  return { threshold: -8 - a * 30, ratio: 1 + a * 11, knee: 6, attack: 0.002, release: 0.07 }
}
export const DOUBLE_DELAYS = [0.017, 0.027] // seconds: left and right copies

// One-tap starting points for a voice. Volume, pan and EQ are left alone.
export const VOCAL_PRESETS = [
  { id: 'none', name: 'No effects', values: { comp: 0, softS: 0, double: 0, delay: 0, reverb: 0 } },
  { id: 'clean', name: 'Clean vocal', values: { comp: 0.4, softS: 0.3, double: 0, delay: 0, reverb: 0.1 } },
  { id: 'radio', name: 'Radio ready', values: { comp: 0.7, softS: 0.4, double: 0.2, delay: 0.1, delayTime: 'eighth', reverb: 0.15 } },
  { id: 'wide', name: 'Wide and thick', values: { comp: 0.5, softS: 0.3, double: 0.6, delay: 0, reverb: 0.2 } },
  { id: 'echo', name: 'Echo throw', values: { comp: 0.5, softS: 0.3, double: 0, delay: 0.45, delayTime: 'dotted', reverb: 0.25 } },
]

// ---- mastering (the whole song) -----------------------------------------------------------------------

export const MAX_BOOST = 14 // dB of extra loudness
export const MASTER_PRESETS = {
  off: { name: 'Off (gentle)', target: null, comp: { threshold: -12, ratio: 4 }, makeup: -1.94, limiter: { threshold: 0, ratio: 1 }, ceiling: -0.1 },
  streaming: { name: 'Streaming', target: -14, comp: { threshold: -18, ratio: 2.5 }, makeup: 2, limiter: { threshold: -3, ratio: 20 }, ceiling: -1 },
  radio: { name: 'Radio', target: -12, comp: { threshold: -20, ratio: 3.5 }, makeup: 5, limiter: { threshold: -4, ratio: 20 }, ceiling: -1 },
  club: { name: 'Club and party', target: -9, comp: { threshold: -22, ratio: 4 }, makeup: 8, limiter: { threshold: -6, ratio: 20 }, ceiling: -0.5 },
}
export const isMasterPreset = (id) => Object.hasOwn(MASTER_PRESETS, id)

export function masteringSettings(master) {
  const preset = MASTER_PRESETS[isMasterPreset(master?.preset) ? master.preset : 'off']
  const boost = preset.target === null ? 0 : clamp(master?.boost, 0, MAX_BOOST, 0)
  return { ...preset, makeupGain: 10 ** ((preset.makeup + boost) / 20), ceilingGain: 10 ** (preset.ceiling / 20) }
}

// A gentle wall just under the ceiling: quiet sound passes untouched, and anything that would go over is
// rounded off instead of cracking.
export function ceilingCurve(ceilingGain, size = 2048) {
  const curve = new Float32Array(size)
  const knee = ceilingGain * 0.85
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= knee ? a : knee + (ceilingGain - knee) * Math.tanh((a - knee) / (ceilingGain - knee))
    curve[i] = Math.sign(x) * Math.min(y, ceilingGain)
  }
  return curve
}
