import { useCallback, useEffect, useState } from 'react'
import {
  addSection,
  defaultSong,
  exportText,
  moveSection,
  normalizeSong,
  removeSection,
  updateSection,
} from '../../engine/lyrics.js'

const STORAGE_KEY = 'gala.lyrics.v1'

function loadSong() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return normalizeSong(JSON.parse(saved))
  } catch {
    // unreadable save, start fresh
  }
  return defaultSong()
}

const fileName = (title) =>
  `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lyrics'}.txt`

// Everything the Lyrics tool does: edit the song, remember it on the device and export it as text.
// The panel only draws the result.
export function useLyrics() {
  const [song, setSong] = useState(loadSong)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(song))
    } catch {
      // storage full or blocked: the words stay on screen, they just will not be remembered
    }
  }, [song])

  const setTitle = useCallback((title) => setSong((s) => normalizeSong({ ...s, title })), [])
  const setLanguage = useCallback((language) => setSong((s) => normalizeSong({ ...s, language })), [])
  const add = useCallback((type) => setSong((s) => addSection(s, type)), [])
  const remove = useCallback((id) => setSong((s) => removeSection(s, id)), [])
  const move = useCallback((id, delta) => setSong((s) => moveSection(s, id, delta)), [])
  const edit = useCallback((id, patch) => setSong((s) => normalizeSong(updateSection(s, id, patch))), [])

  const exportTxt = useCallback(() => {
    const blob = new Blob([exportText(song)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName(song.title)
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [song])

  return { song, setTitle, setLanguage, add, remove, move, edit, exportTxt }
}
