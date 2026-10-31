// Maths for drawing the timeline: seconds to pixels, the ruler, snapping while dragging and the waveform shape.
import { barSeconds, beatSeconds, snapTime } from '../../engine/timeline.js'

// Pixels per second at each zoom step.
export const ZOOM_LEVELS = [8, 16, 32, 64, 128, 256]
export const DEFAULT_ZOOM = 2
export const HEADER_WIDTH = 132
export const TAIL_SECONDS = 16 // empty space after the last clip, so there is always room to add more

export const timeToPx = (seconds, pps) => seconds * pps
export const pxToTime = (px, pps) => px / pps

// The length of one grid step in seconds, or 0 when snapping is off.
export function gridUnit(bpm, grid) {
  return grid === 'beat' ? beatSeconds(bpm) : grid === 'bar' ? barSeconds(bpm) : 0
}

// Where a dragged clip lands: its start plus how far it moved, snapped to the grid.
export function draggedStart(start, deltaPx, pps, bpm, grid) {
  return Math.max(0, snapTime(start + pxToTime(deltaPx, pps), bpm, grid))
}

// Ruler marks. Bars are always marked and beats too once there is room. Returns { time, bar, label }.
export function rulerMarks(duration, bpm, pps) {
  const bar = barSeconds(bpm)
  const beat = beatSeconds(bpm)
  const showBeats = beat * pps >= 18
  const everyBars = bar * pps >= 40 ? 1 : bar * pps >= 20 ? 2 : 4
  const marks = []
  for (let b = 0; b * bar <= duration; b++) {
    const major = b % everyBars === 0
    if (major) marks.push({ time: b * bar, bar: true, label: String(b + 1) })
    if (showBeats && major) {
      for (let k = 1; k < 4; k++) marks.push({ time: b * bar + k * beat, bar: false, label: '' })
    }
  }
  return marks
}

// An SVG path for the outline of a recording between two points of it. `peaks` are 0 to 1, evenly spaced
// across the whole recording. The shape is mirrored around the middle line.
export function waveformPath(peaks, fromFraction, toFraction, width, height) {
  if (!peaks?.length || width <= 0) return ''
  const columns = Math.max(1, Math.min(Math.floor(width), 400))
  const mid = height / 2
  const top = []
  const bottom = []
  for (let x = 0; x < columns; x++) {
    const f = fromFraction + ((x + 0.5) / columns) * (toFraction - fromFraction)
    const index = Math.min(peaks.length - 1, Math.max(0, Math.floor(f * peaks.length)))
    const amplitude = Math.max(0.03, peaks[index]) * mid * 0.95
    const px = ((x + 0.5) / columns) * width
    top.push(`${px.toFixed(1)},${(mid - amplitude).toFixed(1)}`)
    bottom.push(`${px.toFixed(1)},${(mid + amplitude).toFixed(1)}`)
  }
  return `M${top.join(' L')} L${bottom.reverse().join(' L')} Z`
}
