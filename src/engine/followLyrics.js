// Pure helpers for following lyrics along with a beat. Lines are sung one after another from the first bar
// of the beat, either one line a bar or two lines a bar.
import { sectionNames, wordsIn } from './lyrics.js'

// A bar is four beats.
export const barSeconds = (bpm) => (4 * 60) / (Number(bpm) > 0 ? Number(bpm) : 90)

// Every line worth singing, in song order, with the name of the section it belongs to.
export function lyricLines(song) {
  const names = sectionNames(song)
  const out = []
  song.sections.forEach((section, i) => {
    section.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => wordsIn(line).length > 0)
      .forEach((text, n) => out.push({ section: names[i], first: n === 0, text }))
  })
  return out
}

// Which line is being sung `beatSeconds` after the beat started, as an index into lyricLines(), or -1 before the
// beat starts and after the last line.
export function lineAtTime(count, beatSeconds, bpm, linesPerBar = 1) {
  if (count === 0 || !(beatSeconds >= 0)) return -1
  const index = Math.floor(beatSeconds / (barSeconds(bpm) / linesPerBar))
  return index < count ? index : -1
}
