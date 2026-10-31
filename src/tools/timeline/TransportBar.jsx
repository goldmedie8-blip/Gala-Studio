import { Icon } from '../../design/Icon.jsx'
import { TempoInput } from '../../design/TempoInput.jsx'
import { formatBars, formatClock } from '../../engine/timeline.js'
import { ZOOM_LEVELS } from './geometry.js'
import { usePlayhead } from './usePlayhead.js'

const SAVE_LABEL = { saved: 'Saved on this device', saving: 'Saving...', error: 'Could not save' }

function Readout({ t }) {
  const position = usePlayhead(t.getPosition, t.playState === 'playing', t.seekTick)
  return (
    <div className="tl-readout" role="timer" aria-label="Playhead position">
      <strong>{formatClock(position)}</strong>
      <span>{formatBars(position, t.timeline.bpm)}</span>
    </div>
  )
}

export function TransportBar({ t }) {
  const { timeline, playState } = t
  const playing = playState === 'playing'
  return (
    <section className="card tl-transport" aria-label="Transport">
      <div className="tl-group">
        <button type="button" className="icon-btn" aria-label="Go to start" onClick={t.goToStart}>
          <Icon name="skip-back" size={18} />
        </button>
        <button type="button" className={playing ? 'play-btn play-btn-stop' : 'play-btn'} onClick={t.togglePlay}>
          <Icon name={playing ? 'pause' : 'play'} size={20} />
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="icon-btn" aria-label="Stop" onClick={t.stop}>
          <Icon name="stop" size={18} />
        </button>
      </div>

      <Readout t={t} />

      <div className="tl-group">
        <button type="button" className="toggle-btn" aria-pressed={timeline.loop.on} onClick={t.toggleLoop}>
          <Icon name="repeat" size={18} />
          Loop
        </button>
        <button type="button" className="toggle-btn" aria-pressed={timeline.metronome} onClick={t.toggleMetronome}>
          <Icon name="timer" size={18} />
          Metronome
        </button>
      </div>

      <div className="tl-group">
        <label className="tempo-value">
          <TempoInput value={timeline.bpm} onChange={t.changeTempo} />
          <span>BPM</span>
        </label>
        <div className="field tl-snap">
          <label htmlFor="tl-snap">Snap to</label>
          <select id="tl-snap" value={t.grid} onChange={(e) => t.setGrid(e.target.value)}>
            <option value="beat">Beat</option>
            <option value="bar">Bar</option>
            <option value="off">Off</option>
          </select>
        </div>
      </div>

      <div className="tl-group">
        <button type="button" className="icon-btn" aria-label="Zoom out" disabled={t.zoom <= 0} onClick={() => t.setZoom((z) => z - 1)}>
          <Icon name="zoom-out" size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Zoom in"
          disabled={t.zoom >= ZOOM_LEVELS.length - 1}
          onClick={() => t.setZoom((z) => z + 1)}
        >
          <Icon name="zoom-in" size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Undo" disabled={!t.canUndo} onClick={t.undo}>
          <Icon name="undo" size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Redo" disabled={!t.canRedo} onClick={t.redo}>
          <Icon name="redo" size={18} />
        </button>
      </div>

      <div className="tl-group tl-end">
        <span className="save-state" data-state={t.saveState} aria-live="polite">
          {SAVE_LABEL[t.saveState]}
        </span>
        <button type="button" className="btn btn-primary" onClick={t.exportSong} disabled={t.exporting}>
          <Icon name="download" size={18} />
          {t.exporting ? 'Exporting...' : 'Export WAV'}
        </button>
      </div>
    </section>
  )
}
