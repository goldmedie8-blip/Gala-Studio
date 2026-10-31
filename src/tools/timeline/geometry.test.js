import { describe, expect, test } from 'vitest'
import { draggedStart, gridUnit, pxToTime, rulerMarks, timeToPx, waveformPath } from './geometry.js'
import { formatBars, formatClock } from '../../engine/timeline.js'

describe('timeline geometry', () => {
  test('pixels and seconds convert both ways', () => {
    expect(timeToPx(2.5, 32)).toBe(80)
    expect(pxToTime(80, 32)).toBe(2.5)
  })

  test('dragging snaps to the grid and never goes before zero', () => {
    expect(gridUnit(120, 'beat')).toBe(0.5)
    expect(gridUnit(120, 'bar')).toBe(2)
    expect(gridUnit(120, 'off')).toBe(0)
    expect(draggedStart(1, 30, 32, 120, 'beat')).toBe(2) // 1 + 0.94 s lands on the 2 s beat
    expect(draggedStart(1, 30, 32, 120, 'off')).toBeCloseTo(1.9375, 2)
    expect(draggedStart(1, -500, 32, 120, 'beat')).toBe(0)
  })

  test('the ruler marks every bar, and the beats once zoomed in', () => {
    const wide = rulerMarks(8, 120, 64)
    expect(wide.filter((m) => m.bar).map((m) => m.label)).toEqual(['1', '2', '3', '4', '5'])
    expect(wide.some((m) => !m.bar)).toBe(true)
    const narrow = rulerMarks(8, 120, 8)
    expect(narrow.some((m) => !m.bar)).toBe(false)
    expect(narrow.filter((m) => m.bar).length).toBeLessThan(wide.filter((m) => m.bar).length)
  })

  test('the waveform is a closed shape that follows the loudness', () => {
    const path = waveformPath([0, 1, 0, 1], 0, 1, 40, 20)
    expect(path.startsWith('M')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
    expect(waveformPath([], 0, 1, 40, 20)).toBe('')
    expect(waveformPath([1], 0, 1, 0, 20)).toBe('')
  })

  test('time is shown as a clock and as bars and beats', () => {
    expect(formatClock(83.46)).toBe('1:23.4')
    expect(formatClock(-3)).toBe('0:00.0')
    expect(formatBars(0, 120)).toBe('Bar 1.1')
    expect(formatBars(2.5, 120)).toBe('Bar 2.2')
  })
})
