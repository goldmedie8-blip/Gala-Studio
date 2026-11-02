// How loud a song is, measured the way streaming services do it (ITU-R BS.1770: LUFS). Pure maths on
// the samples, so it works on a finished mix and is easy to test.

// Two filters that make the measurement follow how ears hear: a boost for brightness, then a cut for rumble.
function kWeightingCoefficients(sampleRate) {
  const shelf = (() => {
    const f0 = 1681.974450955533
    const G = 3.999843853973347
    const Q = 0.7071752369554196
    const K = Math.tan((Math.PI * f0) / sampleRate)
    const Vh = 10 ** (G / 20)
    const Vb = Vh ** 0.4996667741545416
    const a0 = 1 + K / Q + K * K
    return { b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0], a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] }
  })()
  const high = (() => {
    const f0 = 38.13547087602444
    const Q = 0.5003270373238773
    const K = Math.tan((Math.PI * f0) / sampleRate)
    const a0 = 1 + K / Q + K * K
    return { b: [1, -2, 1], a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] }
  })()
  return [shelf, high]
}

function biquad(input, { b, a }) {
  const out = new Float32Array(input.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i]
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
    out[i] = y
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
  }
  return out
}

const toLufs = (meanSquare) => -0.691 + 10 * Math.log10(meanSquare)

// channels: array of Float32Array (left, right). Returns { lufs, peakDb } (-Infinity when silent).
export function measureLoudness(channels, sampleRate) {
  let peak = 0
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]))
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity

  const filters = kWeightingCoefficients(sampleRate)
  const weighted = channels.map((ch) => filters.reduce((signal, f) => biquad(signal, f), ch))

  // 400 ms blocks, a new one every 100 ms.
  const block = Math.round(0.4 * sampleRate)
  const hop = Math.round(0.1 * sampleRate)
  const length = weighted[0]?.length ?? 0
  const energies = []
  for (let start = 0; start + block <= length; start += hop) {
    let sum = 0
    for (const ch of weighted) {
      let s = 0
      for (let i = start; i < start + block; i++) s += ch[i] * ch[i]
      sum += s / block
    }
    energies.push(sum)
  }
  const loud = energies.filter((e) => e > 0 && toLufs(e) > -70) // quiet blocks are ignored
  if (loud.length === 0) return { lufs: -Infinity, peakDb }
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length
  const gate = toLufs(mean(loud)) - 10
  const kept = loud.filter((e) => toLufs(e) > gate)
  return { lufs: toLufs(mean(kept.length ? kept : loud)), peakDb }
}
