// Lyrics belong to a song. Like a song's multitrack layout, they are kept beside the song instead of inside
// it, and they go when the song is deleted. Small text, so the device's own storage is plenty.
//
//   - A saved song keeps its lyrics under its own key.
//   - Before any song is saved there is one shared draft. It uses the key the Lyrics tool has always used,
//     so nothing written earlier is lost. When that session becomes a saved song, the draft moves into it.
import { defaultSong, normalizeSong } from '../engine/lyrics.js'

const DRAFT_KEY = 'gala.lyrics.v1'
const keyFor = (projectId) => (projectId ? `${DRAFT_KEY}.${projectId}` : DRAFT_KEY)

function read(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null // unreadable save
  }
}

const hasWords = (song) => song.sections.some((s) => s.text.trim() || s.chords.trim())

export function loadLyrics(projectId) {
  const data = read(keyFor(projectId))
  return data ? normalizeSong(data) : defaultSong()
}

// Returns false when the device would not store it, so the caller can say so.
export function saveLyrics(projectId, song) {
  try {
    localStorage.setItem(keyFor(projectId), JSON.stringify(song))
    return true
  } catch {
    return false
  }
}

export function deleteLyrics(projectId) {
  if (!projectId) return
  try {
    localStorage.removeItem(keyFor(projectId))
  } catch {
    // nothing to clean up
  }
}

// A copy of a song starts with the same lyrics.
export function copyLyrics(fromId, toId) {
  if (!fromId || !toId) return
  const data = read(keyFor(fromId))
  if (data) saveLyrics(toId, normalizeSong(data))
}

// The unsaved session has just become a saved song: its draft lyrics go with it. A song that already has
// lyrics is never overwritten. Returns true if the draft moved.
export function adoptDraft(projectId) {
  if (!projectId || read(keyFor(projectId)) !== null) return false
  const draft = read(DRAFT_KEY)
  if (!draft) return false
  const song = normalizeSong(draft)
  if (!hasWords(song)) return false
  if (!saveLyrics(projectId, song)) return false
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // the draft stays too, which is harmless
  }
  return true
}

// ---- backup ----

// The lyrics of the given songs that have any words in them, ready to go into a backup file.
export function exportLyrics(projectIds) {
  const rows = []
  for (const projectId of projectIds) {
    const data = read(keyFor(projectId))
    if (!data) continue
    const song = normalizeSong(data)
    if (hasWords(song)) rows.push({ projectId, song })
  }
  return rows
}

// Puts lyrics from a backup back on this device. Same song ids are overwritten, like the rest of a restore, and
// anything damaged is skipped. Returns how many songs got their lyrics back.
export function importLyrics(rows) {
  let count = 0
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof row?.projectId !== 'string' || !row.projectId) continue
    const song = normalizeSong(row.song)
    if (hasWords(song) && saveLyrics(row.projectId, song)) count += 1
  }
  return count
}
