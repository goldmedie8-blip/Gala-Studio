import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addAudioClip,
  addBeatClip,
  addTrack,
  deleteClip,
  duplicateClip,
  emptyTimeline,
  findClip,
  moveClip,
  newId,
  removeTrack,
  renameClip,
  renameTrack,
  setClipGain,
  setLoop,
  setMasterVolume,
  setMetronome,
  setTempo,
  setTrack,
  snapTime,
  splitClip,
  timelineDuration,
  timelineFromSong,
  trimClipEnd,
  trimClipStart,
  clipEnd,
} from '../../engine/timeline.js'
import { loadBeat } from '../../storage/beatStore.js'
import { blankSong, createProject, getCurrentProjectId, getProject, setCurrentProjectId } from '../../storage/projects.js'
import { listTakes } from '../../storage/takes.js'
import { getTimeline, saveTimeline } from '../../storage/timelines.js'
import { PRESETS, getPreset } from '../beats/presets.js'
import { DEFAULT_ZOOM, ZOOM_LEVELS, gridUnit } from './geometry.js'
import { useAudioEngine } from './useAudioEngine.js'

const SAVE_DELAY_MS = 500
const HISTORY_LIMIT = 50

const starterTimeline = () => {
  let t = emptyTimeline(PRESETS[0].pattern.bpm)
  t = addTrack(t, { kind: 'beat' })
  return addTrack(t, { kind: 'audio' })
}

// Undo puts back the clips and tracks as they were, but keeps your current mixer settings, tempo and loop,
// so undoing a cut does not also undo a fader you moved afterwards.
function restore(previous, current) {
  const tracks = previous.tracks.map((p) => {
    const now = current.tracks.find((t) => t.id === p.id)
    return now ? { ...now, clips: p.clips } : p
  })
  return { ...current, tracks }
}

// Everything the Timeline screen does. The screen only draws it.
export function useTimeline() {
  const [timeline, setTimelineState] = useState(starterTimeline)
  const [loading, setLoading] = useState(() => Boolean(getCurrentProjectId()))
  const [song, setSong] = useState(null)
  const [takes, setTakes] = useState([])
  const [saveState, setSaveState] = useState('saved') // saved | saving | error
  const [playState, setPlayState] = useState('stopped')
  const [seekTick, setSeekTick] = useState(0)
  const [selectedClipId, setSelectedClipId] = useState(null)
  const [selectedTrackId, setSelectedTrackId] = useState(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [grid, setGrid] = useState('beat')
  const [view, setView] = useState('timeline')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [, setHistoryTick] = useState(0)

  const timelineRef = useRef(timeline)
  const dirtyRef = useRef(false)
  const projectIdRef = useRef(getCurrentProjectId())
  const creatingRef = useRef(null)
  const idlePositionRef = useRef(0)
  const pastRef = useRef([])
  const futureRef = useRef([])
  const getTimelineNow = useCallback(() => timelineRef.current, [])

  const { api: audio, version: audioVersion } = useAudioEngine({ getTimeline: getTimelineNow, onEnd: () => setPlayState('stopped') })

  // ---- opening the current song -------------------------------------------------------------------
  useEffect(() => {
    const id = getCurrentProjectId()
    if (!id) return undefined
    let alive = true
    Promise.all([getProject(id), getTimeline(id)])
      .then(([project, saved]) => {
        if (!alive) return
        if (!project) {
          setCurrentProjectId(null)
          projectIdRef.current = null
          return
        }
        setSong(project)
        let opened = saved
        // A song made in Studio opens as a voice track and a beat track, lined up the same way.
        if (!opened && project.takeId) opened = timelineFromSong(project, { voiceSeconds: (project.takeDurationMs ?? 0) / 1000 })
        if (opened) {
          timelineRef.current = opened
          setTimelineState(opened)
          audio.loadAll(opened)
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let alive = true
    listTakes()
      .then((rows) => alive && setTakes(rows))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // ---- saving -------------------------------------------------------------------------------------
  const ensureProjectId = useCallback(async () => {
    if (projectIdRef.current) return projectIdRef.current
    creatingRef.current ??= createProject({ ...blankSong(loadBeat() ?? PRESETS[0].pattern), name: 'Untitled song' }).then((project) => {
      projectIdRef.current = project.id
      setCurrentProjectId(project.id)
      setSong(project)
      return project.id
    })
    return creatingRef.current
  }, [])

  const save = useCallback(async () => {
    if (!dirtyRef.current) return
    // Nothing is saved (and no song is created) until there is something on the timeline.
    if (!projectIdRef.current && !timelineRef.current.tracks.some((t) => t.clips.length > 0)) return
    dirtyRef.current = false
    setSaveState('saving')
    try {
      await saveTimeline(await ensureProjectId(), timelineRef.current)
      setSaveState(dirtyRef.current ? 'saving' : 'saved')
    } catch {
      dirtyRef.current = true
      setSaveState('error')
    }
  }, [ensureProjectId])

  useEffect(() => {
    if (!dirtyRef.current) return undefined
    const timer = setTimeout(save, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [timeline, save])

  useEffect(
    () => () => {
      if (dirtyRef.current) save()
    },
    [save],
  )

  // ---- changing the timeline ---------------------------------------------------------------------
  // `history` makes the change undoable. `restart` replays what is playing so the change is heard.
  const commit = useCallback(
    (change, { history = false, restart = false } = {}) => {
      const current = timelineRef.current
      const next = typeof change === 'function' ? change(current) : change
      if (next === current) return false
      if (history) {
        pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), current]
        futureRef.current = []
        setHistoryTick((n) => n + 1)
      }
      timelineRef.current = next
      dirtyRef.current = true
      setTimelineState(next)
      setSaveState('saving')
      audio.apply(next, { restart })
      return true
    },
    [audio],
  )

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return
    futureRef.current.push(timelineRef.current)
    const next = restore(previous, timelineRef.current)
    timelineRef.current = next
    dirtyRef.current = true
    setTimelineState(next)
    setHistoryTick((n) => n + 1)
    audio.apply(next, { restart: true })
  }, [audio])

  const redo = useCallback(() => {
    const following = futureRef.current.pop()
    if (!following) return
    pastRef.current.push(timelineRef.current)
    const next = restore(following, timelineRef.current)
    timelineRef.current = next
    dirtyRef.current = true
    setTimelineState(next)
    setHistoryTick((n) => n + 1)
    audio.apply(next, { restart: true })
  }, [audio])

  // ---- transport -----------------------------------------------------------------------------------
  const getPosition = useCallback(() => {
    const engine = audio.engineRef.current
    return engine && engine.player.state === 'playing' ? engine.player.position() : idlePositionRef.current
  }, [audio.engineRef])

  const play = useCallback(async () => {
    setError('')
    try {
      const engine = await audio.ensureEngine()
      await audio.loadAll(timelineRef.current)
      engine.player.play(idlePositionRef.current)
      setPlayState('playing')
    } catch (e) {
      setError(e.message || 'Could not start audio.')
    }
  }, [audio])

  const pause = useCallback(() => {
    const engine = audio.engineRef.current
    if (!engine) return
    engine.player.pause()
    idlePositionRef.current = engine.player.pos
    setPlayState('paused')
    setSeekTick((n) => n + 1)
  }, [audio.engineRef])

  const stop = useCallback(() => {
    audio.engineRef.current?.player.stop()
    idlePositionRef.current = 0
    setPlayState('stopped')
    setSeekTick((n) => n + 1)
  }, [audio.engineRef])

  const togglePlay = useCallback(() => (playState === 'playing' ? pause() : play()), [playState, pause, play])

  const seek = useCallback(
    (time) => {
      const t = Math.max(0, time)
      idlePositionRef.current = t
      audio.engineRef.current?.player.seek(t)
      setSeekTick((n) => n + 1)
    },
    [audio.engineRef],
  )

  // ---- tracks and clips --------------------------------------------------------------------------
  const unit = gridUnit(timeline.bpm, grid)
  const snap = useCallback((t) => snapTime(t, timelineRef.current.bpm, grid), [grid])

  const pickTrack = useCallback(
    (kind) => {
      const current = timelineRef.current
      const selected = current.tracks.find((t) => t.id === selectedTrackId && t.kind === kind)
      return selected ?? current.tracks.find((t) => t.kind === kind)
    },
    [selectedTrackId],
  )

  const addNewTrack = useCallback(
    (kind) => {
      const id = newId()
      const added = commit((t) => addTrack(t, { kind, id }), { history: true })
      if (added) setSelectedTrackId(id)
      return id
    },
    [commit],
  )

  const deleteTrack = useCallback(
    (trackId) => {
      commit((t) => removeTrack(t, trackId), { history: true, restart: true })
      setSelectedTrackId((id) => (id === trackId ? null : id))
      setSelectedClipId(null)
    },
    [commit],
  )

  const rename = useCallback((trackId, name) => commit((t) => renameTrack(t, trackId, name)), [commit])
  const setTrackValue = useCallback((trackId, patch) => commit((t) => setTrack(t, trackId, patch)), [commit])
  const setMaster = useCallback((v) => commit((t) => setMasterVolume(t, v)), [commit])
  const changeTempo = useCallback((bpm) => commit((t) => setTempo(t, bpm), { restart: true }), [commit])
  const toggleMetronome = useCallback(() => commit((t) => setMetronome(t, !t.metronome), { restart: true }), [commit])
  const toggleLoop = useCallback(
    () =>
      commit(
        (t) => {
          const end = Math.max(timelineDuration(t), 4)
          return setLoop(t, t.loop.on ? { on: false } : { on: true, end: t.loop.end > 0.5 ? t.loop.end : end })
        },
        { restart: true },
      ),
    [commit],
  )

  const addRecording = useCallback(
    (takeId) => {
      const take = takes.find((t) => t.id === takeId)
      if (!take) return
      let trackId = pickTrack('audio')?.id
      if (!trackId) trackId = addNewTrack('audio')
      const clipId = newId()
      const start = snap(getPosition())
      commit(
        (t) => addAudioClip(t, trackId, { id: clipId, takeId, name: take.name, start, source: Math.max(0.1, take.durationMs / 1000) }),
        { history: true, restart: true },
      )
      setSelectedClipId(clipId)
      audio.loadBuffer(takeId)
    },
    [takes, pickTrack, addNewTrack, snap, getPosition, commit, audio],
  )

  const addBeat = useCallback(
    (styleId, bars) => {
      const preset = styleId === 'current' ? null : getPreset(styleId)
      const pattern = preset?.pattern ?? loadBeat() ?? PRESETS[0].pattern
      let trackId = pickTrack('beat')?.id
      if (!trackId) trackId = addNewTrack('beat')
      const clipId = newId()
      const start = snap(getPosition())
      const empty = timelineRef.current.tracks.every((t) => t.clips.length === 0)
      commit(
        (t) => {
          const withTempo = empty ? setTempo(t, pattern.bpm) : t // the first thing you add sets the tempo
          return addBeatClip(withTempo, trackId, { id: clipId, name: preset?.name ?? 'My beat', start, bars, pattern })
        },
        { history: true, restart: true },
      )
      setSelectedClipId(clipId)
    },
    [pickTrack, addNewTrack, snap, getPosition, commit],
  )

  const selected = useMemo(() => (selectedClipId ? findClip(timeline, selectedClipId) : null), [timeline, selectedClipId])

  const edit = useCallback((change) => commit(change, { history: true, restart: true }), [commit])

  const moveSelected = useCallback(
    (clipId, placement) => edit((t) => moveClip(t, clipId, placement)),
    [edit],
  )
  const trimStart = useCallback((clipId, time) => edit((t) => trimClipStart(t, clipId, time)), [edit])
  const trimEnd = useCallback((clipId, time) => edit((t) => trimClipEnd(t, clipId, time)), [edit])

  const splitAtPlayhead = useCallback(() => {
    if (!selectedClipId) return
    const newClip = newId()
    const done = commit((t) => splitClip(t, selectedClipId, getPosition(), newClip), { history: true, restart: true })
    if (done) setSelectedClipId(newClip)
  }, [selectedClipId, commit, getPosition])

  const duplicateSelected = useCallback(() => {
    if (!selectedClipId) return
    const copy = newId()
    if (commit((t) => duplicateClip(t, selectedClipId, copy), { history: true, restart: true })) setSelectedClipId(copy)
  }, [selectedClipId, commit])

  const deleteSelected = useCallback(() => {
    if (!selectedClipId) return
    commit((t) => deleteClip(t, selectedClipId), { history: true, restart: true })
    setSelectedClipId(null)
  }, [selectedClipId, commit])

  // Moves the selected clip one grid step earlier or later (a tenth of a second when snapping is off).
  const nudgeSelected = useCallback(
    (direction) => {
      if (!selected) return
      const step = unit || 0.1
      const to = Math.max(0, selected.clip.start + direction * step)
      edit((t) => moveClip(t, selected.clip.id, { start: snapTime(to, t.bpm, grid) }))
    },
    [selected, unit, grid, edit],
  )

  const trimStartToPlayhead = useCallback(() => selected && trimStart(selected.clip.id, getPosition()), [selected, trimStart, getPosition])
  const trimEndToPlayhead = useCallback(() => selected && trimEnd(selected.clip.id, getPosition()), [selected, trimEnd, getPosition])
  const changeClipGain = useCallback((clipId, gain) => commit((t) => setClipGain(t, clipId, gain), { restart: true }), [commit])
  const changeClipName = useCallback((clipId, name) => commit((t) => renameClip(t, clipId, name)), [commit])

  // Loops the selected clip, or the whole song if nothing is selected.
  const loopSelection = useCallback(() => {
    const bpm = timelineRef.current.bpm
    const range = selected ? { start: selected.clip.start, end: clipEnd(selected.clip, bpm) } : { start: 0, end: Math.max(timelineDuration(timelineRef.current), 1) }
    commit((t) => setLoop(t, { on: true, ...range }), { restart: true })
  }, [selected, commit])

  const select = useCallback((clipId, trackId) => {
    setSelectedClipId(clipId)
    if (trackId) setSelectedTrackId(trackId)
  }, [])

  const exportSong = useCallback(async () => {
    setError('')
    setExporting(true)
    try {
      const blob = await audio.exportMix(timelineRef.current)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const name = (song?.name ?? 'gala-song').replace(/[^\w -]+/g, '').trim() || 'gala-song'
      link.href = url
      link.download = `${name}.wav`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      setError(e.message || 'Could not export the song.')
    } finally {
      setExporting(false)
    }
  }, [audio, song])

  const getLevels = useCallback(() => audio.engineRef.current?.mixer.levels() ?? null, [audio.engineRef])

  // Make sure a recording used by a freshly opened or restored timeline is loaded, so its waveform shows.
  useEffect(() => {
    audio.loadAll(timeline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline])

  const refreshTakes = useCallback(() => listTakes().then(setTakes).catch(() => {}), [])

  return {
    timeline,
    loading,
    song,
    takes,
    saveState,
    playState,
    seekTick,
    selected,
    selectedClipId,
    selectedTrackId,
    zoom,
    pps: ZOOM_LEVELS[zoom],
    grid,
    view,
    exporting,
    error,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    audio,
    audioVersion,
    setZoom: (fn) => setZoom((z) => Math.min(ZOOM_LEVELS.length - 1, Math.max(0, typeof fn === 'function' ? fn(z) : fn))),
    setGrid,
    setView,
    getPosition,
    getLevels,
    play,
    pause,
    stop,
    togglePlay,
    seek,
    goToStart: () => seek(0),
    undo,
    redo,
    addNewTrack,
    deleteTrack,
    rename,
    setTrackValue,
    setMaster,
    changeTempo,
    toggleMetronome,
    toggleLoop,
    loopSelection,
    addRecording,
    addBeat,
    moveClip: moveSelected,
    trimStart,
    trimEnd,
    splitAtPlayhead,
    duplicateSelected,
    deleteSelected,
    nudgeSelected,
    trimStartToPlayhead,
    trimEndToPlayhead,
    changeClipGain,
    changeClipName,
    select,
    selectTrack: setSelectedTrackId,
    exportSong,
    refreshTakes,
    clearError: () => setError(''),
  }
}
