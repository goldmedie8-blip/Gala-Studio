import { useEffect, useState } from 'react'
import { formatDuration } from '../../engine/format.js'
import { extensionFor } from '../../engine/recorder.js'
import { Icon } from '../../design/Icon.jsx'
import './record.css'
import { useRecorder } from './useRecorder.js'

function Meter({ level, clipping }) {
  const percent = Math.round(level * 100)
  return (
    <div className="meter" role="meter" aria-label="Input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="meter-fill" data-clipping={clipping} style={{ width: `${percent}%` }} />
    </div>
  )
}

function useObjectUrl(blob) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function TakeRow({ take, onDelete }) {
  const url = useObjectUrl(take.blob)
  const filename = `gala-${take.name.toLowerCase().replace(/\s+/g, '-')}.${extensionFor(take.mimeType)}`
  return (
    <li className="take">
      <div className="take-head">
        <strong>{take.name}</strong>
        <span className="muted">{formatDuration(take.durationMs)}</span>
      </div>
      {url && <audio controls src={url} preload="metadata" aria-label={`Play ${take.name}`} />}
      <div className="take-actions">
        <a className="btn btn-secondary" href={url} download={filename}>
          <Icon name="download" size={18} />
          Download
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => onDelete(take.id)}>
          <Icon name="trash" size={18} />
          Delete
        </button>
      </div>
    </li>
  )
}

export default function Panel() {
  const rec = useRecorder()
  const recording = rec.status === 'recording'

  return (
    <div className="rec">
      <section className="card rec-main" aria-label="Recorder">
        {rec.status === 'idle' ? (
          <div className="rec-start">
            <span className="tile tile-lg">
              <Icon name="mic" size={26} />
            </span>
            <h2>Set up your microphone</h2>
            <p className="muted">
              Gala needs permission to use your microphone. Recording stays on this device and works without internet.
            </p>
            <button type="button" className="btn btn-primary" onClick={rec.enable}>
              <Icon name="mic" size={18} />
              Enable microphone
            </button>
          </div>
        ) : (
          <>
            <div className="rec-field">
              <label htmlFor="rec-input">Input</label>
              <select
                id="rec-input"
                value={rec.deviceId}
                disabled={recording}
                onChange={(e) => rec.changeDevice(e.target.value)}
              >
                {rec.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <Meter level={rec.meter.level} clipping={rec.meter.clipping} />
            <p className="rec-hint" data-clipping={rec.meter.clipping}>
              {rec.meter.clipping ? 'Too loud. Move back from the microphone or lower the gain.' : 'Make some sound to see the level move.'}
            </p>

            <div className="rec-controls">
              <time className="rec-time" aria-live="off">
                {formatDuration(rec.elapsed)}
              </time>
              <button
                type="button"
                className={recording ? 'rec-btn rec-btn-stop' : 'rec-btn'}
                onClick={recording ? rec.stop : rec.start}
              >
                <Icon name={recording ? 'stop' : 'record'} size={20} />
                {recording ? 'Stop' : 'Record'}
              </button>
            </div>
          </>
        )}

        {rec.error && (
          <p className="rec-error" role="alert">
            {rec.error}
          </p>
        )}
      </section>

      <section aria-labelledby="takes-heading">
        <h2 id="takes-heading" className="section-title">
          Your takes
        </h2>
        {rec.takes.length > 0 ? (
          <ul className="takes">
            {rec.takes.map((take) => (
              <TakeRow key={take.id} take={take} onDelete={rec.removeTake} />
            ))}
          </ul>
        ) : (
          <p className="muted">No takes yet. Press Record, sing or play something, then press Stop.</p>
        )}
      </section>
    </div>
  )
}
