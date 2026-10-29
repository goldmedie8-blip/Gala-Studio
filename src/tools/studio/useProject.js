import { useCallback, useEffect, useRef, useState } from 'react'
import {
  blankSong,
  createProject,
  saveProject,
  setCurrentProjectId,
  snapshotFields,
} from '../../storage/projects.js'
import { PRESETS } from '../beats/presets.js'

const AUTOSAVE_MS = 600
const DEFAULT_NAME = 'My song'

const keyOf = (name, snapshot) => JSON.stringify({ name, ...snapshot })
const cleanName = (name) => name.trim() || 'Untitled song'

// Keeps the song Studio is working on saved on the device. Once a song exists, every change to the
// voice, beat, timing or volumes is saved a moment later, and a pending change is saved when you leave.
export function useProject({ snapshot, initialProject, onSwitchProject }) {
  const [project, setProject] = useState(initialProject ?? null)
  const [name, setName] = useState(initialProject?.name ?? DEFAULT_NAME)
  const [saveState, setSaveState] = useState(initialProject ? 'saved' : 'unsaved') // unsaved | saving | saved | error

  const projectRef = useRef(initialProject ?? null)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const nameRef = useRef(name)
  nameRef.current = name
  // What was last written to the device, so an unchanged song is never saved again.
  const savedKeyRef = useRef(initialProject ? keyOf(initialProject.name, snapshotFields(initialProject)) : '')
  const key = keyOf(name, snapshot)
  const keyRef = useRef(key)
  keyRef.current = key
  const hasProject = Boolean(project)

  const write = useCallback(async () => {
    const writtenKey = keyRef.current
    await saveProject({ ...projectRef.current, name: cleanName(nameRef.current), ...snapshotRef.current })
    savedKeyRef.current = writtenKey
  }, [])

  useEffect(() => {
    if (!hasProject || key === savedKeyRef.current) return undefined
    setSaveState('saving')
    const timer = setTimeout(async () => {
      try {
        await write()
        setSaveState(keyRef.current === savedKeyRef.current ? 'saved' : 'saving')
      } catch {
        setSaveState('error')
      }
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [key, hasProject, write])

  // Leaving Studio (or opening another song) saves any change still waiting.
  useEffect(
    () => () => {
      if (projectRef.current && keyRef.current !== savedKeyRef.current) write().catch(() => {})
    },
    [write],
  )

  // Turns the work in front of you into a saved song.
  const saveAsSong = useCallback(async () => {
    setSaveState('saving')
    try {
      const writtenKey = keyRef.current
      const saved = await createProject({ ...snapshotRef.current, name: cleanName(nameRef.current) })
      projectRef.current = saved
      savedKeyRef.current = writtenKey
      setCurrentProjectId(saved.id)
      setProject(saved)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [])

  const newSong = useCallback(async () => {
    setSaveState('saving')
    try {
      onSwitchProject(await createProject(blankSong(PRESETS[0].pattern)))
    } catch {
      setSaveState('error')
    }
  }, [onSwitchProject])

  return { project, name, setName, saveState, saveAsSong, newSong }
}
