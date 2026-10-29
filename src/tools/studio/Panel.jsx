import { useCallback, useEffect, useState } from 'react'
import { saveBeat } from '../../storage/beatStore.js'
import { getCurrentProjectId, getProject, setCurrentProjectId } from '../../storage/projects.js'
import Screen from './Screen.jsx'

// Opens Studio on the song you were working on. Studio only starts once that song is loaded, so the
// screen is built from the saved song and nothing is ever saved over it by mistake.
export default function Panel() {
  const [state, setState] = useState(() => ({ loading: Boolean(getCurrentProjectId()), project: null, key: 0 }))

  useEffect(() => {
    const id = getCurrentProjectId()
    if (!id) return undefined
    let alive = true
    getProject(id)
      .then((project) => {
        if (!project) setCurrentProjectId(null) // the song was deleted
        if (alive) setState((s) => ({ ...s, loading: false, project: project ?? null }))
      })
      .catch(() => alive && setState((s) => ({ ...s, loading: false })))
    return () => {
      alive = false
    }
  }, [])

  // Switching songs rebuilds the screen from the new song.
  const switchProject = useCallback((project) => {
    setCurrentProjectId(project?.id ?? null)
    if (project) saveBeat(project.beat)
    setState((s) => ({ loading: false, project: project ?? null, key: s.key + 1 }))
  }, [])

  if (state.loading) return <p className="muted">Opening your song...</p>
  return <Screen key={state.key} initialProject={state.project} onSwitchProject={switchProject} />
}
