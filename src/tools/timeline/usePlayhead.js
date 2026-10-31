import { useEffect, useState } from 'react'

// The playhead position, redrawn every frame while playing. Only the small pieces of the screen that
// show it use this, so the rest of the screen does not redraw 60 times a second.
export function usePlayhead(getPosition, playing, tick) {
  const [position, setPosition] = useState(() => getPosition())
  useEffect(() => {
    setPosition(getPosition())
    if (!playing) return undefined
    let frame = 0
    const loop = () => {
      setPosition(getPosition())
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [getPosition, playing, tick])
  return position
}
