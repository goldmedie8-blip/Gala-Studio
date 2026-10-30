import { Icon } from '../../design/Icon.jsx'
import { TempoInput } from '../../design/TempoInput.jsx'
import { useState } from 'react'
import { DRUM_LANES, MAX_BARS, SECTION_LETTERS, SECTION_NAMES, STEPS } from '../../engine/pattern.js'
import { KEYS, MELODY_ROWS, SCALES, degreeToMidi, noteName } from '../../engine/scale.js'
import { BASS_SOUND_IDS, SOUNDS } from '../../engine/voices.js'
import './beats.css'
import { PRESETS } from './presets.js'
import { useBeatMachine } from './useBeatMachine.js'

const STEP_INDEXES = Array.from({ length: STEPS }, (_, i) => i)
const ROW_INDEXES = Array.from({ length: MELODY_ROWS }, (_, i) => MELODY_ROWS - 1 - i) // highest note on top

function StepCell({ on, active, beat, label, onClick }) {
  return (
    <button
      type="button"
      className="cell"
      data-on={on}
      data-active={active}
      data-beat={beat}
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
    />
  )
}

export default function Panel() {
  const beat = useBeatMachine()
  const { pattern, playhead } = beat
  const [track, setTrack] = useState('melody') // which notes grid is open: 'melody' or 'bass'
  const isBass = track === 'bass'
  const soundId = isBass ? pattern.bassSound : pattern.sound
  const sound = SOUNDS[soundId]
  const soundOptions = isBass ? BASS_SOUND_IDS : Object.keys(SOUNDS)
  const notes = pattern[track]
  const notePrefix = isBass ? 'Bass ' : ''
  // The step lights up only while the section you are looking at is the one being heard.
  const lit = (i) => playhead?.index === pattern.active && playhead.local === i

  return (
    <div className="beats">
      <section className="card beats-bar" aria-label="Transport">
        <button
          type="button"
          className={beat.playing ? 'play-btn play-btn-stop' : 'play-btn'}
          onClick={beat.playing ? beat.stop : beat.play}
        >
          <Icon name={beat.playing ? 'stop' : 'play'} size={20} />
          {beat.playing ? 'Stop' : 'Play'}
        </button>

        <div className="tempo" role="group" aria-label="Tempo">
          <button type="button" className="icon-btn" aria-label="Slower" onClick={() => beat.nudgeTempo(-1)}>
            <Icon name="minus" size={18} />
          </button>
          <label className="tempo-value">
            <TempoInput value={pattern.bpm} onChange={(v) => beat.setField('bpm', v)} />
            <span>BPM</span>
          </label>
          <button type="button" className="icon-btn" aria-label="Faster" onClick={() => beat.nudgeTempo(1)}>
            <Icon name="plus" size={18} />
          </button>
        </div>

        <div className="seg" role="group" aria-label="What to play">
          <button type="button" aria-pressed={beat.playMode === 'section'} onClick={() => beat.setPlayMode('section')}>
            Loop section
          </button>
          <button type="button" aria-pressed={beat.playMode === 'song'} onClick={() => beat.setPlayMode('song')}>
            Whole song
          </button>
        </div>

        <div className="field">
          <label htmlFor="beat-swing">Swing</label>
          <input
            id="beat-swing"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={pattern.swing}
            onChange={(e) => beat.setField('swing', e.target.value)}
          />
        </div>

        <div className="beats-actions">
          <button type="button" className="btn btn-secondary" onClick={beat.clear}>
            <Icon name="trash" size={18} />
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={beat.exportWav} disabled={beat.exporting}>
            <Icon name="download" size={18} />
            {beat.exporting ? 'Exporting...' : 'Export WAV'}
          </button>
        </div>
      </section>

      {beat.error && (
        <p className="alert" role="alert">
          {beat.error}
        </p>
      )}

      <section aria-labelledby="presets-heading">
        <h2 id="presets-heading" className="section-title">
          Start from a style
        </h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip-btn" onClick={() => beat.applyPreset(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="structure-heading">
        <h2 id="structure-heading" className="section-title">
          Song structure
        </h2>
        <div className="structure-row">
          <div className="seg" role="group" aria-label="Section you are editing">
            {SECTION_LETTERS.map((letter, i) => (
              <button
                key={letter}
                type="button"
                aria-pressed={pattern.active === i}
                aria-label={`Edit section ${letter}, ${SECTION_NAMES[i]}`}
                onClick={() => beat.selectSection(i)}
              >
                <strong>{letter}</strong> {SECTION_NAMES[i]}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="copy-from">Copy a section into this one</label>
            <select
              id="copy-from"
              value=""
              onChange={(e) => e.target.value !== '' && beat.copyFromSection(Number(e.target.value))}
            >
              <option value="">Choose a section...</option>
              {SECTION_LETTERS.map((letter, i) =>
                i === pattern.active ? null : (
                  <option key={letter} value={i}>
                    {letter} {SECTION_NAMES[i]}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div className="bars-row">
          <div className="bars" role="group" aria-label="Arrangement">
            {pattern.order.map((index, bar) => (
              <button
                key={bar}
                type="button"
                className="bar-chip"
                data-playing={playhead?.bar === bar}
                aria-label={`Bar ${bar + 1}: section ${SECTION_LETTERS[index]}. Press to change.`}
                onClick={() => beat.setBar(bar, (index + 1) % SECTION_LETTERS.length)}
              >
                {SECTION_LETTERS[index]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove last bar"
            disabled={pattern.order.length <= 1}
            onClick={beat.removeBar}
          >
            <Icon name="minus" size={18} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Add bar"
            disabled={pattern.order.length >= MAX_BARS}
            onClick={beat.addBar}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
        <p className="muted hint">
          Edit one section at a time, then press a bar to choose which section plays there. Choose Whole song to hear
          the arrangement from start to end.
        </p>
      </section>

      <section className="card" aria-labelledby="drums-heading">
        <h2 id="drums-heading" className="section-title">
          Drums
        </h2>
        <div className="lanes">
          {DRUM_LANES.map((lane) => (
            <div key={lane.id} className="lane">
              <button type="button" className="lane-name" onClick={() => beat.previewDrum(lane.id)} aria-label={`Hear ${lane.name}`}>
                {lane.name}
              </button>
              <div className="cells" role="group" aria-label={`${lane.name} steps`}>
                {STEP_INDEXES.map((i) => (
                  <StepCell
                    key={i}
                    on={pattern.drums[lane.id][i]}
                    active={lit(i)}
                    beat={i % 4 === 0}
                    label={`${lane.name} step ${i + 1}`}
                    onClick={() => beat.toggleStep(lane.id, i)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="melody-heading">
        <div className="melody-head">
          <h2 id="melody-heading">Notes</h2>
          <div className="seg" role="group" aria-label="Notes line">
            <button type="button" aria-pressed={!isBass} onClick={() => setTrack('melody')}>
              Melody
            </button>
            <button type="button" aria-pressed={isBass} onClick={() => setTrack('bass')}>
              Bass
            </button>
          </div>
        </div>
        <div className="melody-settings">
          <div className="field">
            <label htmlFor="beat-sound">Sound</label>
            <select
              id="beat-sound"
              value={soundId}
              onChange={(e) => beat.setField(isBass ? 'bassSound' : 'sound', e.target.value)}
            >
              {soundOptions.map((id) => (
                <option key={id} value={id}>
                  {SOUNDS[id].name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="beat-key">Key</label>
            <select id="beat-key" value={pattern.key} onChange={(e) => beat.setField('key', Number(e.target.value))}>
              {KEYS.map((k, i) => (
                <option key={k} value={i}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="beat-scale">Scale</label>
            <select id="beat-scale" value={pattern.scale} onChange={(e) => beat.setField('scale', e.target.value)}>
              {Object.entries(SCALES).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="lanes">
          {ROW_INDEXES.map((degree) => {
            const name = noteName(degreeToMidi({ degree, key: pattern.key, scale: pattern.scale, octave: sound.octave }))
            return (
              <div key={degree} className="lane">
                <span className="lane-name lane-note">{name}</span>
                <div className="cells" role="group" aria-label={isBass ? `Bass note ${name} steps` : `Note ${name} steps`}>
                  {STEP_INDEXES.map((i) => (
                    <StepCell
                      key={i}
                      on={notes[i] === degree}
                      active={lit(i)}
                      beat={i % 4 === 0}
                      label={`${notePrefix}${name} step ${i + 1}`}
                      onClick={() => beat.toggleNote(i, degree, track)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="muted hint">Every note fits the key and scale you choose, so it always sounds musical.</p>
      </section>
    </div>
  )
}
