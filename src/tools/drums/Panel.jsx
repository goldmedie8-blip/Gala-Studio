import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../design/Icon.jsx'
import { hasHits } from '../../engine/drumPart.js'
import { DRUM_LANES, STEPS } from '../../engine/pattern.js'
import './drums.css'
import { useDrumPads } from './useDrumPads.js'

const PAD_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';']
const typing = (target) => /^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName) || target?.isContentEditable

export default function Panel() {
  const p = useDrumPads()
  const busy = p.mode !== 'idle'
  const { hit } = p

  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const i = PAD_KEYS.indexOf(e.key.toLowerCase())
      if (i >= 0) hit(DRUM_LANES[i].id)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [hit])

  const total = p.bars * STEPS
  return (
    <div className="drums-tool">
      <section className="card dr-transport" aria-label="Transport">
        <div className="dr-group">
          {busy ? (
            <button type="button" className="play-btn play-btn-stop" onClick={p.stop}>
              <Icon name="stop" size={20} />
              Stop
            </button>
          ) : (
            <>
              <button type="button" className="play-btn dr-record" onClick={p.record}>
                <Icon name="mic" size={20} />
                Record
              </button>
              <button type="button" className="btn btn-secondary" onClick={p.play} disabled={!hasHits(p.hits)}>
                <Icon name="play" size={18} />
                Play part
              </button>
            </>
          )}
          <span className="dr-status" role="status">
            {p.mode === 'counting' ? 'Get ready...' : p.mode === 'recording' ? 'Recording' : p.mode === 'playing' ? 'Playing' : ''}
          </span>
        </div>
        <div className="dr-group">
          <label className="tempo-value">
            <input type="number" min="60" max="200" inputMode="numeric" aria-label="Tempo in beats per minute" value={p.bpm} onChange={(e) => p.setBpm(e.target.value)} />
            <span>BPM</span>
          </label>
          <div className="field">
            <label htmlFor="dr-bars">Part length</label>
            <select id="dr-bars" value={p.bars} onChange={(e) => p.setBars(e.target.value)}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'bar' : 'bars'}
                </option>
              ))}
            </select>
          </div>
          <label className="field dr-swing">
            <span>Swing</span>
            <input type="range" min="0" max="1" step="0.05" value={p.swing} aria-label="Swing" onChange={(e) => p.setSwing(e.target.value)} />
          </label>
          <button type="button" className="toggle-btn" aria-pressed={p.click} onClick={() => p.setClick(!p.click)}>
            Click
          </button>
          <button type="button" className="toggle-btn" aria-pressed={p.countIn} onClick={() => p.setCountIn(!p.countIn)}>
            Count-in
          </button>
        </div>
        <p className="muted dr-song">{p.song ? `Song: ${p.song.name}.` : 'No song yet. Saving makes one.'} Drums are added as their own track and loop across the song.</p>
      </section>

      {p.error && (
        <p className="alert" role="alert">
          {p.error}
        </p>
      )}

      <div className="dr-pads" role="group" aria-label="Drum pads">
        {DRUM_LANES.map((lane, i) => (
          <button
            key={lane.id}
            type="button"
            className="dr-pad"
            data-flash={p.flash.has(lane.id)}
            aria-label={`Pad ${lane.name}`}
            onPointerDown={(e) => {
              e.preventDefault()
              hit(lane.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') hit(lane.id)
            }}
          >
            <strong>{lane.name}</strong>
            <span>{PAD_KEYS[i].toUpperCase()}</span>
          </button>
        ))}
      </div>
      <p className="muted">On a laptop the pads are the keys A S D F G H J K L ;</p>

      <section className="card dr-part" aria-label="Your part">
        <div className="dr-grid-scroll">
          <div className="dr-grid" style={{ '--steps': total }}>
            {DRUM_LANES.map((lane) => (
              <div key={lane.id} className="dr-row">
                <span className="dr-lane">
                  {lane.name}
                  <button type="button" className="dr-lane-clear" aria-label={`Clear ${lane.name}`} onClick={() => p.clearLane(lane.id)}>
                    x
                  </button>
                </span>
                <div className="dr-cells">
                  {p.hits[lane.id].map((on, step) => (
                    <button
                      key={step}
                      type="button"
                      className="dr-cell"
                      data-on={on}
                      data-beat={step % 4 === 0}
                      data-now={busy && Math.floor(p.position) === step}
                      aria-pressed={on}
                      aria-label={`${lane.name} step ${step + 1}`}
                      onClick={() => p.toggleStep(lane.id, step)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="dr-group">
          <div className="field">
            <label htmlFor="dr-name">Part name</label>
            <input id="dr-name" className="input" type="text" maxLength={40} value={p.partName} onChange={(e) => p.setPartName(e.target.value)} />
          </div>
          {p.bars > 1 && (
            <button type="button" className="btn btn-secondary" onClick={p.repeatFirstBar}>
              Repeat bar 1
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={p.undo} disabled={!p.canUndo}>
            <Icon name="undo" size={18} />
            Undo
          </button>
          <button type="button" className="btn btn-secondary" onClick={p.clear} disabled={!hasHits(p.hits)}>
            <Icon name="trash" size={18} />
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={p.saveToSong} disabled={p.saving}>
            <Icon name="plus" size={18} />
            Add to my song
          </button>
        </div>
        {p.saved && (
          <p className="dr-saved" role="status">
            Added to {p.saved.songName} as a drum track. <Link to="/timeline">Open in Timeline</Link>
          </p>
        )}
      </section>
    </div>
  )
}
