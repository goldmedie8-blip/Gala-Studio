// Turns a block of microphone samples (-1 to 1) into a meter reading.
// level is 0 to 1 across a -60 dB to 0 dB range, which matches how loudness is heard.
export function levelFromTimeDomain(samples) {
  let sum = 0
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    sum += s * s
    const a = Math.abs(s)
    if (a > peak) peak = a
  }
  const rms = Math.sqrt(sum / (samples.length || 1))
  const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity
  const level = Math.min(1, Math.max(0, (db + 60) / 60))
  return { level, peak, db, clipping: peak >= 0.99 }
}
