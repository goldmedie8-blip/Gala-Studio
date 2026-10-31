import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../design/Icon.jsx'
import { formatDuration } from '../../engine/format.js'
import { MAX_BEAT_BARS } from '../../engine/timeline.js'
import { PRESETS } from '../beats/presets.js'

// Adds tracks, recordings and beats to the song. New things go where the playhead is.
export function AddPanel({ t }) {
  const [takeId, setTakeId] = useState('')
  const [style, setStyle] = useState('current')
  const [bars, setBars] = useState(8)
  const chosenTake = t.takes.find((x) => x.id === takeId) ?? t.takes[0]

  return (
    <details className="card tl-add" open>
      <summary>Add to your song</summary>
      <div className="tl-add-grid">
        <div className="tl-add-block">
          <h3>Tracks</h3>
          <div className="tl-group">
            <button type="button" className="btn btn-secondary" onClick={() => t.addNewTrack('beat')}>
              <Icon name="plus" size={18} />
              Add beat track
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => t.addNewTrack('audio')}>
              <Icon name="plus" size={18} />
              Add audio track
            </button>
          </div>
        </div>

        <div className="tl-add-block">
          <h3>Recording</h3>
          {t.takes.length === 0 ? (
            <p className="muted">
              You have no recordings yet. <Link to="/record">Record a voice</Link> first.
            </p>
          ) : (
            <div className="tl-group">
              <div className="field">
                <label htmlFor="tl-take">Recording</label>
                <select id="tl-take" value={chosenTake?.id ?? ''} onChange={(e) => setTakeId(e.target.value)} onFocus={t.refreshTakes}>
                  {t.takes.map((take) => (
                    <option key={take.id} value={take.id}>
                      {take.name} ({formatDuration(take.durationMs)})
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => chosenTake && t.addRecording(chosenTake.id)}>
                <Icon name="plus" size={18} />
                Add recording
              </button>
            </div>
          )}
        </div>

        <div className="tl-add-block">
          <h3>Beat</h3>
          <div className="tl-group">
            <div className="field">
              <label htmlFor="tl-style">Beat style</label>
              <select id="tl-style" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="current">My current beat</option>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field tl-bars">
              <label htmlFor="tl-bars">Bars</label>
              <input
                id="tl-bars"
                className="input"
                type="number"
                min="1"
                max={MAX_BEAT_BARS}
                value={bars}
                onChange={(e) => setBars(Math.min(MAX_BEAT_BARS, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => t.addBeat(style, bars)}>
              <Icon name="plus" size={18} />
              Add beat
            </button>
          </div>
        </div>
      </div>
    </details>
  )
}
