import { Link } from 'react-router-dom'
import { Icon } from '../../design/Icon.jsx'
import { TempoInput } from '../../design/TempoInput.jsx'
import { formatDuration } from '../../engine/format.js'
import { KEYS, SCALES } from '../../engine/scale.js'
import { MAX_OFFSET, MIN_OFFSET, planStart } from '../../engine/mix.js'
import { SOUNDS } from '../../engine/voices.js'
import { PRESETS } from '../beats/presets.js'
import './studio.css'
import { useVoiceBeat } from './useVoiceBeat.js'

const percent = (value) => `${Math.round(value * 100)}%`
const signedSeconds = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)} s`

function Timeline({ voice, offset, position, playing }) {
  const { voiceDelay, beatDelay } = planStart(offset)
  const total = voiceDelay + voice.buffer.duration
  const at = (seconds) => `${(seconds / total) * 100}%`
  return (
    <div
      className="timeline"
      role="img"
      aria-label={`Voice waveform. The beat starts ${signedSeconds(offset)} from the voice.`}
      style={{ '--lead': at(voiceDelay), '--span': at(voice.buffer.duration), '--beat': at(beatDelay) }}
    >
      <div className="timeline-voice">
        {voice.peaks.map((peak, i) => (
          <span key={i} style={{ height: `${Math.max(6, peak * 100)}%` }} />
        ))}
      </div>
      <div className="timeline-beat" data-label="Beat starts" />
      {playing && <div className="timeline-head" style={{ left: at(Math.min(position, total)) }} />}
    </div>
  )
}

export default function Panel() {
  const studio = useVoiceBeat()
  const { pattern, voice } = studio
  const total = voice ? planStart(studio.offset).voiceDelay + voice.buffer.duration : 0
  const maxOffset = voice ? Math.min(MAX_OFFSET, Math.max(5, Math.ceil(voice.buffer.duration))) : 5

  return (
    <div className="studio">
      <section className="card" aria-labelledby="voice-heading">
        <div className="studio-head">
          <h2 id="voice-heading">Your voice</h2>
          <label className="btn btn-secondary file-btn">
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              aria-label="Add audio file"
              onChange={(e) => {
                studio.addFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Icon name="upload" size={18} />
            Add audio file
          </label>
        </div>

        {!studio.takesLoaded ? (
          <p className="muted">Loading your recordings...</p>
        ) : studio.takes.length === 0 ? (
          <div className="studio-empty">
            <h3>No voice yet</h3>
            <p className="muted">Record your voice first, or add an audio file you already have.</p>
            <Link className="btn btn-primary" to="/record">
              <Icon name="mic" size={18} />
              Record a voice
            </Link>
          </div>
        ) : (
          <ul className="voice-list" role="radiogroup" aria-label="Choose a voice">
            {studio.takes.map((take) => (
              <li key={take.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={take.id === studio.selectedId}
                  className="voice-option"
                  onClick={() => studio.selectTake(take.id)}
                >
                  <Icon name="waveform" size={18} />
                  <span className="voice-name">{take.name}</span>
                  <span className="muted">{formatDuration(take.durationMs)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {studio.loadingVoice && <p className="muted">Opening audio...</p>}
        {voice && (
          <>
            <Timeline voice={voice} offset={studio.offset} position={studio.position} playing={studio.playing} />
            <div className="align">
              <label htmlFor="beat-start">Beat starts</label>
              <div className="align-controls">
                <button type="button" className="icon-btn" aria-label="Beat earlier" onClick={() => studio.nudgeOffset(-0.01)}>
                  <Icon name="chevron-left" size={20} />
                </button>
                <input
                  id="beat-start"
                  type="range"
                  min={MIN_OFFSET}
                  max={maxOffset}
                  step="0.01"
                  value={studio.offset}
                  onChange={(e) => studio.setOffset(e.target.value)}
                />
                <button type="button" className="icon-btn" aria-label="Beat later" onClick={() => studio.nudgeOffset(0.01)}>
                  <Icon name="chevron-right" size={20} />
                </button>
                <output className="align-value" htmlFor="beat-start">
                  {signedSeconds(studio.offset)}
                </output>
              </div>
              <p className="muted hint">
                Slide to the moment the first beat should land. Below zero, the beat plays first and your voice comes in
                after it.
              </p>
            </div>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="beat-heading">
        <div className="studio-head">
          <h2 id="beat-heading">Beat</h2>
          <Link className="btn btn-secondary" to="/beats">
            <Icon name="drum" size={18} />
            Edit this beat
          </Link>
        </div>

        <div className="presets" role="group" aria-label="Beat style">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip-btn" onClick={() => studio.applyPreset(p.id)}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="studio-row">
          <div className="tempo" role="group" aria-label="Tempo">
            <button type="button" className="icon-btn" aria-label="Slower" onClick={() => studio.nudgeTempo(-1)}>
              <Icon name="minus" size={18} />
            </button>
            <label className="tempo-value">
              <TempoInput value={pattern.bpm} onChange={(v) => studio.setField('bpm', v)} />
              <span>BPM</span>
            </label>
            <button type="button" className="icon-btn" aria-label="Faster" onClick={() => studio.nudgeTempo(1)}>
              <Icon name="plus" size={18} />
            </button>
          </div>

          <button type="button" className="btn btn-secondary" onClick={studio.tap}>
            <Icon name="timer" size={18} />
            Tap tempo
          </button>
          <button type="button" className="chip-btn" onClick={() => studio.scaleTempo(0.5)}>
            Half
          </button>
          <button type="button" className="chip-btn" onClick={() => studio.scaleTempo(2)}>
            Double
          </button>

          <div className="field">
            <label htmlFor="studio-key">Key</label>
            <select id="studio-key" value={pattern.key} onChange={(e) => studio.setField('key', Number(e.target.value))}>
              {KEYS.map((k, i) => (
                <option key={k} value={i}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="muted hint">
          Press Play, then tap along with your voice to find the tempo. Playing now: {SOUNDS[pattern.sound].name} in{' '}
          {KEYS[pattern.key]} {SCALES[pattern.scale].name.toLowerCase()}.
        </p>
      </section>

      <section className="card" aria-labelledby="mix-heading">
        <h2 id="mix-heading" className="section-title">
          Balance
        </h2>
        <div className="mix">
          <div className="field">
            <label htmlFor="voice-volume">Voice {percent(studio.voiceVolume)}</label>
            <input
              id="voice-volume"
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={studio.voiceVolume}
              onChange={(e) => studio.changeVoiceVolume(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="beat-volume">Beat {percent(studio.beatVolume)}</label>
            <input
              id="beat-volume"
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={studio.beatVolume}
              onChange={(e) => studio.changeBeatVolume(e.target.value)}
            />
          </div>
        </div>
      </section>

      {studio.error && (
        <p className="alert" role="alert">
          {studio.error}
        </p>
      )}

      <section className="card studio-transport" aria-label="Playback">
        <button
          type="button"
          className={studio.playing ? 'play-btn play-btn-stop' : 'play-btn'}
          disabled={!voice}
          onClick={studio.playing ? studio.stop : studio.play}
        >
          <Icon name={studio.playing ? 'stop' : 'play'} size={20} />
          {studio.playing ? 'Stop' : 'Play'}
        </button>
        <time className="studio-time">
          {formatDuration(studio.position * 1000)} / {formatDuration(total * 1000)}
        </time>
        <button
          type="button"
          className="btn btn-primary studio-export"
          disabled={!voice || studio.exporting}
          onClick={studio.exportMix}
        >
          <Icon name="download" size={18} />
          {studio.exporting ? 'Exporting...' : 'Export song (WAV)'}
        </button>
      </section>
    </div>
  )
}
