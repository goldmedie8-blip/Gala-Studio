import { useEffect, useRef } from 'react'
import { runShortcut, shortcutFor } from './shortcuts.js'

// Lets the Timeline be played and edited from the keyboard. Always uses the latest timeline state, and stops
// listening when the Timeline closes.
export function useTimelineKeys(t) {
  const latest = useRef(t)
  latest.current = t

  useEffect(() => {
    const onKeyDown = (event) => {
      const action = shortcutFor(event)
      if (action && runShortcut(action, latest.current)) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
