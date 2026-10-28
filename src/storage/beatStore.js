// The beat is shared: the Beats tool and the Studio tool read and write the same saved pattern,
// so a beat made in Beats is the one that plays under your voice in Studio.
import { normalizePattern } from '../engine/pattern.js'

export const BEAT_STORAGE_KEY = 'gala.beat.v1'

// Returns the saved pattern, or null if nothing usable is saved yet.
export function loadBeat() {
  try {
    const saved = localStorage.getItem(BEAT_STORAGE_KEY)
    if (saved) return normalizePattern(JSON.parse(saved))
  } catch {
    // unreadable save
  }
  return null
}

export function saveBeat(pattern) {
  try {
    localStorage.setItem(BEAT_STORAGE_KEY, JSON.stringify(pattern))
  } catch {
    // storage full or blocked: the beat still plays, it just will not be remembered
  }
}
