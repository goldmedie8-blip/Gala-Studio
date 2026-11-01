import { useCallback, useEffect, useState } from 'react'
import { addSection, exportText, moveSection, normalizeSong, removeSection, updateSection } from '../../engine/lyrics.js'
import { loadLyrics, saveLyrics } from '../../storage/lyricsStore.js'
import { getCurrentProjectId, getProject } from '../../storage/projects.js'

const fileName = (title) =>
  `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lyrics'}.txt`

// Everything the Lyrics tool does: edit the lyrics of the song you are working on in Studio, remember them on
// the device and export them as text. With no saved song yet, you are writing a draft that moves into the
// first song you save. The panel only draws the result.
export function useLyrics() {
  const [projectId] = useState(getCurrentProjectId) // the song open in Studio when you came here
  const [song, setSong] = useState(() => loadLyrics(projectId))
  const [songName, setSongName] = useState('')

  useEffect(() => {
    if (!projectId) return undefined
    let alive = true
    Promise.resolve()
      .then(() => getProject(projectId))
      .then((project) => alive && project && setSongName(project.name))
      .catch(() => {}) // the name is only a label
    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    saveLyrics(projectId, song) // if the device refuses, the words stay on screen, they just will not be remembered
  }, [projectId, song])

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

  const attachedTo = projectId
    ? `Writing the lyrics for ${songName ? `"${songName}"` : 'your current song'}.`
    : 'A draft, not attached to a song yet. Save a song in Studio and these lyrics go with it.'

  return { song, attachedTo, setTitle, setLanguage, add, remove, move, edit, exportTxt }
}
