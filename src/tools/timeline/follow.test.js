import { describe, expect, test } from 'vitest'
import { followScroll } from './follow.js'

// A 1000 px wide window, with the track names taking the first 132 px.
const view = (playheadPx, scrollLeft = 0) => followScroll({ playheadPx, scrollLeft, viewWidth: 1000, headerWidth: 132 })

describe('following the playhead', () => {
  test('nothing moves while the playhead is in view', () => {
    expect(view(132)).toBe(null)
    expect(view(500)).toBe(null)
    expect(view(970)).toBe(null)
    expect(view(1500, 1000)).toBe(null)
  })

  test('when it runs off the right edge, the view jumps to put it near the left', () => {
    const scroll = view(1200)
    expect(scroll).toBe(Math.round(1200 - 132 - (1000 - 132) * 0.15))
    // after the jump it is in view and not at the very edge
    const onScreen = 1200 - scroll
    expect(onScreen > 132 && onScreen < 400).toBe(true)
  })

  test('when it is hidden under the track names, the view moves back to it', () => {
    expect(view(300, 400)).toBe(Math.round(300 - 132 - 868 * 0.15))
  })

  test('the view never scrolls before the start', () => {
    expect(view(150, 600)).toBe(Math.max(0, Math.round(150 - 132 - 868 * 0.15)))
    expect(view(140, 600)).toBe(0)
  })

  test('without a measured window it does nothing', () => {
    expect(followScroll({ playheadPx: 5000, scrollLeft: 0, viewWidth: 0, headerWidth: 132 })).toBe(null)
    expect(followScroll({ playheadPx: 5000, scrollLeft: 0, viewWidth: 100, headerWidth: 132 })).toBe(null)
  })
})
