// A count-in: short clicks before the beat so the singer knows when to start.
// The first click of each bar is higher, so "1 2 3 4" is easy to hear.
export const COUNT_IN_BEATS = 4

export function scheduleCountIn(ctx, dest, start, bpm, beats = COUNT_IN_BEATS) {
  const gap = 60 / bpm
  for (let i = 0; i < beats; i++) {
    const time = start + i * gap
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(i % 4 === 0 ? 1600 : 1100, time)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.8, time)
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.06)
    osc.connect(amp)
    amp.connect(dest)
    osc.start(time)
    osc.stop(time + 0.08)
  }
}
