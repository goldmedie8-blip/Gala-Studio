// Tap tempo: tap along with the voice and Gala works out the speed.
// Takes tap times in milliseconds, oldest first. Returns BPM, or null until there are two taps.
export function bpmFromTaps(times, { maxGap = 2000, maxTaps = 8 } = {}) {
  // Only the latest run of taps counts. A long pause means a fresh start.
  let run = [times[times.length - 1]]
  for (let i = times.length - 2; i >= 0; i--) {
    if (times[i + 1] - times[i] > maxGap) break
    run.unshift(times[i])
  }
  run = run.slice(-maxTaps)
  if (run.length < 2 || run[0] === undefined) return null

  const interval = (run[run.length - 1] - run[0]) / (run.length - 1)
  if (!(interval > 0)) return null

  // Fold into the range the beat maker supports: tapping every other beat still gives a sensible tempo.
  let bpm = 60000 / interval
  while (bpm < 60) bpm *= 2
  while (bpm > 200) bpm /= 2
  return Math.round(bpm)
}
