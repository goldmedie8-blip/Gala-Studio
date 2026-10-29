import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../design/Icon.jsx'
import { EmptyState } from '../design/EmptyState.jsx'
import { BackupError, buildBackup, restoreBackup } from '../storage/backup.js'
import { saveBeat } from '../storage/beatStore.js'
import {
  blankSong,
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
  setCurrentProjectId,
} from '../storage/projects.js'
import { PRESETS } from '../tools/beats/presets.js'
import { formatDuration } from '../engine/format.js'
import './library.css'

const formatDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function SongCard({ song, onOpen, onDuplicate, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(song.name)
  const [confirming, setConfirming] = useState(false)

  const submitRename = (event) => {
    event.preventDefault()
    onRename(song.id, name)
    setRenaming(false)
  }

  return (
    <li className="song">
      <span className="tile tile-lg">
        <Icon name="music" size={26} />
      </span>
      <div className="song-body">
        {renaming ? (
          <form className="song-rename" onSubmit={submitRename}>
            <input
              className="input"
              type="text"
              maxLength={80}
              aria-label={`New name for ${song.name}`}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Icon name="check" size={18} />
              Save name
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <h3 className="song-name">{song.name}</h3>
        )}
        <p className="muted song-meta">
          {song.beat.bpm} BPM
          <span aria-hidden="true"> · </span>
          {song.takeName ? `${song.takeName} (${formatDuration(song.takeDurationMs)})` : 'No voice yet'}
          <span aria-hidden="true"> · </span>
          Updated {formatDate(song.updatedAt)}
        </p>
      </div>

      <div className="song-actions">
        {confirming ? (
          <>
            <span className="song-confirm">Delete this song? Your recordings are kept.</span>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(song.id)}>
              <Icon name="trash" size={18} />
              Yes, delete
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={() => onOpen(song)} aria-label={`Open ${song.name}`}>
              <Icon name="play" size={18} />
              Open
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Rename ${song.name}`}
              title="Rename"
              onClick={() => {
                setName(song.name)
                setRenaming(true)
              }}
            >
              <Icon name="edit" size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Duplicate ${song.name}`}
              title="Duplicate"
              onClick={() => onDuplicate(song.id)}
            >
              <Icon name="copy" size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Delete ${song.name}`}
              title="Delete"
              onClick={() => setConfirming(true)}
            >
              <Icon name="trash" size={18} />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export default function Library() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState(null) // null while loading
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const list = await listProjects()
      if (alive.current) setSongs(list)
    } catch {
      if (!alive.current) return
      setSongs([])
      setError('Your songs could not be opened on this device.')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Studio works on one song at a time. Opening a song makes it the one Studio shows.
  const open = useCallback(
    (song) => {
      setCurrentProjectId(song.id)
      saveBeat(song.beat)
      navigate('/studio')
    },
    [navigate],
  )

  const attempt = useCallback(
    async (action, failure) => {
      setError('')
      setMessage('')
      try {
        await action()
      } catch (e) {
        if (alive.current) setError(e instanceof BackupError ? e.message : failure)
      }
    },
    [],
  )

  const newSong = () =>
    attempt(async () => {
      open(await createProject(blankSong(PRESETS[0].pattern)))
    }, 'Could not create a new song.')

  const duplicate = (id) =>
    attempt(async () => {
      await duplicateProject(id)
      await refresh()
    }, 'Could not duplicate that song.')

  const rename = (id, name) =>
    attempt(async () => {
      await renameProject(id, name)
      await refresh()
    }, 'Could not rename that song.')

  const remove = (id) =>
    attempt(async () => {
      await deleteProject(id)
      await refresh()
    }, 'Could not delete that song.')

  const backUp = () =>
    attempt(async () => {
      const { blob, projects, takes } = await buildBackup()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `gala-backup-${new Date().toISOString().slice(0, 10)}.gala`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setMessage(`Backup saved: ${plural(projects, 'song')} and ${plural(takes, 'recording')}.`)
    }, 'Could not make a backup.')

  const restore = (file) => {
    if (!file) return undefined
    return attempt(async () => {
      const result = await restoreBackup(file)
      await refresh()
      setMessage(`Restored ${plural(result.projects, 'song')} and ${plural(result.takes, 'recording')}.`)
    }, 'Could not restore that backup.')
  }

  return (
    <div className="page">
      <header className="library-head">
        <h1>Library</h1>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={newSong}>
            <Icon name="plus" size={18} />
            New song
          </button>
          <button type="button" className="btn btn-secondary" onClick={backUp}>
            <Icon name="download" size={18} />
            Back up everything
          </button>
          <label className="btn btn-secondary file-btn">
            <input
              type="file"
              accept=".gala"
              className="sr-only"
              aria-label="Restore backup"
              onChange={(e) => {
                restore(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Icon name="upload" size={18} />
            Restore backup
          </label>
        </div>
      </header>

      {message && (
        <p className="notice-ok" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {songs === null ? (
        <p className="muted">Opening your songs...</p>
      ) : songs.length === 0 ? (
        <EmptyState icon="library" title="No songs yet">
          Start a new song, then record your voice over a beat in Studio. Everything is saved on this device and works
          without internet.
        </EmptyState>
      ) : (
        <ul className="songs" aria-label="Your songs">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              onOpen={open}
              onDuplicate={duplicate}
              onRename={rename}
              onDelete={remove}
            />
          ))}
        </ul>
      )}

      <p className="muted hint">
        Songs and recordings stay on this device. Use Back up everything to keep a copy you can move to another phone or
        restore later.
      </p>
    </div>
  )
}
