// Keeping the playhead in view while the song plays. The view moves one "page" at a time, which is easier to
// follow than a view that slides all the time.

// The scroll position that brings the playhead back into view, or null if it is already visible.
//   playheadPx   where the playhead is, from the left edge of the whole timeline (track names included)
//   scrollLeft   how far the timeline is scrolled now
//   viewWidth    how wide the visible window is
//   headerWidth  the track names on the left stay put, so the lanes start this far in
//   lead         where the playhead lands after a jump, as a fraction of the visible lanes
export function followScroll({ playheadPx, scrollLeft, viewWidth, headerWidth, lead = 0.15, margin = 24 }) {
  if (!(viewWidth > headerWidth)) return null
  const visibleStart = scrollLeft + headerWidth
  const visibleEnd = scrollLeft + viewWidth - margin
  if (playheadPx >= visibleStart && playheadPx <= visibleEnd) return null
  const lanes = viewWidth - headerWidth
  return Math.max(0, Math.round(playheadPx - headerWidth - lanes * lead))
}
