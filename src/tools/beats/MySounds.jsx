import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../design/Icon.jsx'
import { unlockAudio } from '../../engine/audioContext.js'
import { readKit, setLaneSound } from '../../engine/drumKit.js'
import { formatDuration } from '../../engine/format.js'
import { DRUM_LANES } from '../../engine/pattern.js'
import { createMaster, playDrum } from '../../engine/playback.js'
import { listTakes } from '../../storage/takes.js'
import './mySounds.css'

// Lets each drum play a recording of your own instead of the built-in sound: record one clean hit of an
// engoma, a clap or a shaker in Record, then choose it here. Kept inside a closed section so the Beats page
// stays tidy for people who do not need it.
export default function MySounds() {
  const [takes, setTakes] = useState(null) // null while loading
  const [kit, setKit] = useState(readKit)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const masterRef = useRef(null)

  useEffect(() => {
    let alive = true
    listTakes()
      .then((rows) => alive && setTakes(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setTakes([]))
    return () => {
      alive = false
    }
  }, [])

  async function choose(laneId, takeId) {
    setError('')
    setBusy(laneId)
    try {
      await setLaneSound(laneId, takeId)
      setKit(readKit())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  async function hear(laneId) {
    try {
      const ctx = await unlockAudio()
      if (masterRef.current?.ctx !== ctx) masterRef.current = createMaster(ctx)
      playDrum(ctx, masterRef.current.input, laneId, ctx.currentTime + 0.01)
    } catch {
      // a preview is a nicety, never an error
    }
  }

  const inUse = Object.keys(kit).length

  return (
    <details className="card ks">
      <summary className="ks-summary">My sounds{inUse > 0 ? ` (${inUse} in use)` : ''}</summary>
      <p className="muted ks-intro">
        Play your own recordings instead of the built-in drums. In Record, record one clean hit (an engoma, a clap, a
        shaker), then choose it for a drum here. Short recordings of a single hit work best.
      </p>
      {takes !== null && takes.length === 0 && (
        <p className="muted ks-intro">You have no recordings yet. Open Record, record one short hit, then come back.</p>
      )}
      <div className="ks-rows">
        {DRUM_LANES.map((lane) => {
          const chosen = kit[lane.id] ?? ''
          const missing = chosen !== '' && takes !== null && !takes.some((t) => t.id === chosen)
          return (
            <div key={lane.id} className="ks-row">
              <span className="ks-lane">{lane.name}</span>
              <select
                className="ks-select"
                aria-label={`${lane.name} sound`}
                value={chosen}
                disabled={busy !== ''}
                onChange={(e) => choose(lane.id, e.target.value)}
              >
                <option value="">Built-in sound</option>
                {missing && <option value={chosen}>Recording not found</option>}
                {(takes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatDuration(t.durationMs)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Preview ${lane.name} sound`}
                onClick={() => hear(lane.id)}
              >
                <Icon name="play" size={18} />
              </button>
            </div>
          )
        })}
      </div>
      {busy && <p className="muted ks-intro">Getting your recording ready...</p>}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </details>
  )
}
