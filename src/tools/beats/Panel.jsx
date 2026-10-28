import { Icon } from '../../design/Icon.jsx'
import { TempoInput } from '../../design/TempoInput.jsx'
import { DRUM_LANES, STEPS } from '../../engine/pattern.js'
import { KEYS, MELODY_ROWS, SCALES, degreeToMidi, noteName } from '../../engine/scale.js'
import { SOUNDS } from '../../engine/voices.js'
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
  const { pattern } = beat
  const sound = SOUNDS[pattern.sound]

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
                    active={beat.step === i}
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
          <h2 id="melody-heading">Melody</h2>
          <div className="melody-settings">
            <div className="field">
              <label htmlFor="beat-sound">Sound</label>
              <select id="beat-sound" value={pattern.sound} onChange={(e) => beat.setField('sound', e.target.value)}>
                {Object.entries(SOUNDS).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.name}
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
        </div>

        <div className="lanes">
          {ROW_INDEXES.map((degree) => {
            const name = noteName(degreeToMidi({ degree, key: pattern.key, scale: pattern.scale, octave: sound.octave }))
            return (
              <div key={degree} className="lane">
                <span className="lane-name lane-note">{name}</span>
                <div className="cells" role="group" aria-label={`Note ${name} steps`}>
                  {STEP_INDEXES.map((i) => (
                    <StepCell
                      key={i}
                      on={pattern.melody[i] === degree}
                      active={beat.step === i}
                      beat={i % 4 === 0}
                      label={`${name} step ${i + 1}`}
                      onClick={() => beat.toggleNote(i, degree)}
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
