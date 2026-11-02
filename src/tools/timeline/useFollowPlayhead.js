import { useEffect, useRef } from 'react'
import { followScroll } from './follow.js'
import { HEADER_WIDTH, timeToPx } from './geometry.js'

const HOLD_MS = 2500 // after you scroll by hand, the view leaves you alone for a moment

// Scrolls the timeline to keep the playhead visible while playing, and when you jump to a time (Home, a click
// on the ruler) that is off screen. Scrolling by hand pauses the following briefly so it never fights you.
export function useFollowPlayhead(t, scrollRef) {
  const latest = useRef(t)
  latest.current = t
  const holdUntil = useRef(0)

  // The timeline may not be on screen yet (no tracks), so listen on the page and check where the touch happened.
  useEffect(() => {
    const hold = (event) => {
      if (scrollRef.current?.contains(event.target)) holdUntil.current = performance.now() + HOLD_MS
    }
    const events = ['wheel', 'touchmove', 'pointerdown']
    for (const name of events) document.addEventListener(name, hold, { passive: true, capture: true })
    return () => {
      for (const name of events) document.removeEventListener(name, hold, { capture: true })
    }
  }, [scrollRef])

  useEffect(() => {
    const check = (force) => {
      const el = scrollRef.current
      const now = latest.current
      if (!el || !el.clientWidth) return
      if (!force && performance.now() < holdUntil.current) return
      const target = followScroll({
        playheadPx: HEADER_WIDTH + timeToPx(now.getPosition(), now.pps),
        scrollLeft: el.scrollLeft,
        viewWidth: el.clientWidth,
        headerWidth: HEADER_WIDTH,
      })
      if (target !== null) el.scrollLeft = target
    }

    if (t.playState !== 'playing') {
      check(true) // a jump while stopped (Home, the ruler) always shows where you landed
      return undefined
    }
    let frame = 0
    const tick = () => {
      check(false)
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [t.playState, t.seekTick, scrollRef])
}
