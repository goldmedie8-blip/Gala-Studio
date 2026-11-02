import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../design/Icon.jsx'
import { QUANTIZE } from '../../engine/notes.js'
import { CHORDS, COMPUTER_KEYS, SOUNDS } from '../../engine/piano.js'
import { KEYS, SCALES } from '../../engine/scale.js'
import { Keyboard } from './Keyboard.jsx'
import { NoteRoll } from './NoteRoll.jsx'
import './piano.css'
import { isInKey, usePiano } from './usePiano.js'

const typing = (target) => /^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName) || target?.isContentEditable

export default function Panel() {
  const p = useDocumentKeys(usePiano())
  const busy = p.mode !== 'idle'
  const counting = p.mode === 'counting'

  return (
    <div className="piano-tool">
      <section className="card pn-transport" aria-label="Transport">
        <div className="pn-group">
          {busy ? (
            <button type="button" className="play-btn play-btn-stop" onClick={p.stop}>
              <Icon name="stop" size={20} />
              Stop
            </button>
          ) : (
            <>
              <button type="button" className="play-btn pn-record" onClick={p.record}>
                <Icon name="mic" size={20} />
                Record
              </button>
              <button type="button" className="btn btn-secondary" onClick={p.play} disabled={p.notes.length === 0 && !p.withBeat}>
                <Icon name="play" size={18} />
                Play part
              </button>
            </>
          )}
          <span className="pn-status" role="status">
            {counting ? `Get ready... ${Math.floor(4 + p.position) + 1}` : p.mode === 'recording' ? 'Recording' : p.mode === 'playing' ? 'Playing' : ''}
          </span>
        </div>

        <div className="pn-group">
          <label className="tempo-value">
            <input type="number" min="60" max="200" inputMode="numeric" aria-label="Tempo in beats per minute" value={p.bpm} onChange={(e) => p.setBpm(e.target.value)} />
            <span>BPM</span>
          </label>
          <div className="field">
            <label htmlFor="pn-bars">Part length</label>
            <select id="pn-bars" value={p.bars} onChange={(e) => p.setBars(e.target.value)}>
              {[1, 2, 4, 8, 16].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'bar' : 'bars'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pn-quantize">Timing</label>
            <select id="pn-quantize" value={p.quantizeId} onChange={(e) => p.setQuantizeId(e.target.value)}>
              {QUANTIZE.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pn-group">
          <button type="button" className="toggle-btn" aria-pressed={p.withBeat} onClick={() => p.setWithBeat(!p.withBeat)}>
            <Icon name="drum" size={18} />
            Beat
          </button>
          <button type="button" className="toggle-btn" aria-pressed={p.metronome} onClick={() => p.setMetronome(!p.metronome)}>
            Click
          </button>
          <button type="button" className="toggle-btn" aria-pressed={p.countIn} onClick={() => p.setCountIn(!p.countIn)}>
            Count-in
          </button>
        </div>
        <p className="muted pn-song">{p.song ? `Song: ${p.song.name}. The beat of this song plays under you.` : 'No song yet. Your beat from Beats plays under you. Saving makes a song.'}</p>
      </section>

      {p.error && (
        <p className="alert" role="alert">
          {p.error}
        </p>
      )}

      <section className="card pn-instrument" aria-label="Instrument">
        <div className="pn-group">
          <div className="field">
            <label htmlFor="pn-sound">Sound</label>
            <select id="pn-sound" value={p.sound} onChange={(e) => p.setSound(e.target.value)}>
              {SOUNDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pn-chord">Chords</label>
            <select id="pn-chord" value={p.chord} onChange={(e) => p.setChord(e.target.value)}>
              {Object.entries(CHORDS).map(([id, c]) => (
                <option key={id} value={id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="pn-octave" role="group" aria-label="Octave">
            <button type="button" className="icon-btn" aria-label="Octave down" onClick={() => p.shiftOctave(-1)}>
              <Icon name="chevron-left" size={18} />
            </button>
            <span>Octave {p.octave}</span>
            <button type="button" className="icon-btn" aria-label="Octave up" onClick={() => p.shiftOctave(1)}>
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
        </div>
        <div className="pn-group">
          <button type="button" className="toggle-btn" aria-pressed={p.showKey} onClick={() => p.setShowKey(!p.showKey)}>
            Show key
          </button>
          <button type="button" className="toggle-btn" aria-pressed={p.snap} onClick={() => p.setSnap(!p.snap)}>
            Stay in key
          </button>
          <div className="field">
            <label htmlFor="pn-root">Key</label>
            <select id="pn-root" value={p.keyRoot} onChange={(e) => p.setKeyRoot(Number(e.target.value))}>
              {KEYS.map((k, i) => (
                <option key={k} value={i}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pn-scale">Scale</label>
            <select id="pn-scale" value={p.scale} onChange={(e) => p.setScale(e.target.value)}>
              {Object.entries(SCALES).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <Keyboard
        base={p.base}
        held={p.held}
        onDown={p.noteDown}
        onUp={p.noteUp}
        inKey={p.showKey || p.snap ? (m) => isInKey(m, p.keyRoot, p.scale) : null}
      />
      <p className="muted pn-help">On a laptop you can play with the letter keys A to L (black keys W, E, T, Y, U, O, P). Z and X change the octave.</p>

      <section className="card pn-part" aria-label="Your part">
        <NoteRoll notes={p.notes} bars={p.bars} position={p.position} mode={p.mode} onRemove={p.removeNote} />
        <div className="pn-group">
          <div className="field">
            <label htmlFor="pn-name">Part name</label>
            <input id="pn-name" className="input" type="text" maxLength={40} value={p.partName} onChange={(e) => p.setPartName(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary" onClick={p.undo} disabled={!p.canUndo}>
            <Icon name="undo" size={18} />
            Undo
          </button>
          <button type="button" className="btn btn-secondary" onClick={p.tidyUp} disabled={p.notes.length === 0 || p.quantizeId === 'off'}>
            Tidy up timing
          </button>
          <button type="button" className="btn btn-secondary" onClick={p.clear} disabled={p.notes.length === 0}>
            <Icon name="trash" size={18} />
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={p.saveToSong} disabled={p.saving}>
            <Icon name="plus" size={18} />
            Add to my song
          </button>
        </div>
        {p.saved && (
          <p className="pn-saved" role="status">
            Added to {p.saved.songName} as a piano track. <Link to="/timeline">Open in Timeline</Link>
          </p>
        )}
      </section>
    </div>
  )
}

// Letter keys play the piano on a laptop. Typing in a box never plays notes.
function useDocumentKeys(p) {
  const { noteDown, noteUp, releaseAll, shiftOctave, base } = p
  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z') return shiftOctave(-1)
      if (key === 'x') return shiftOctave(1)
      if (key in COMPUTER_KEYS) noteDown(base + COMPUTER_KEYS[key], 0.8)
    }
    const up = (e) => {
      const key = e.key.toLowerCase()
      if (key in COMPUTER_KEYS) noteUp(base + COMPUTER_KEYS[key])
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', releaseAll)
    }
  }, [noteDown, noteUp, releaseAll, shiftOctave, base])
  return p
}
