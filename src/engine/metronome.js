// A short click for the metronome. The first beat of each bar is higher so you can hear where the bar starts.
export function playClick(ctx, dest, time, accent = false) {
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(accent ? 1760 : 1175, time)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(accent ? 0.35 : 0.22, time)
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
  osc.connect(amp)
  amp.connect(dest)
  osc.start(time)
  osc.stop(time + 0.06)
}
