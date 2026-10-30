import { Link } from 'react-router-dom'
import { Icon } from '../../design/Icon.jsx'
import { TempoInput } from '../../design/TempoInput.jsx'
import { formatDuration } from '../../engine/format.js'
import { KEYS, SCALES } from '../../engine/scale.js'
import { MAX_OFFSET, MIN_OFFSET, planStart } from '../../engine/mix.js'
import { SOUNDS } from '../../engine/voices.js'
import { nextTakeName } from '../../storage/takes.js'
import { PRESETS } from '../beats/presets.js'
import './studio.css'
import { MAX_SYNC_MS, MIN_SYNC_MS, useBeatRecorder } from './useBeatRecorder.js'
import { SECTION_LETTERS } from '../../engine/pattern.js'
import { useProject } from './useProject.js'
import { useVoiceBeat } from './useVoiceBeat.js'

const RECORDER_STATUS = { ready: 'Ready', counting: 'Get ready...', recording: 'Recording', saving: 'Saving...' }

function Meter({ level, clipping }) {
  const value = Math.round(level * 100)
  return (
    <div className="meter" role="meter" aria-label="Input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="meter-fill" data-clipping={clipping} style={{ width: `${value}%` }} />
    </div>
  )
}

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

const SAVE_LABEL = {
  unsaved: 'Not saved yet',
  saving: 'Saving...',
  saved: 'Saved on this device',
  error: 'Could not save',
}

export default function Screen({ initialProject, onSwitchProject }) {
  const studio = useVoiceBeat({ initialProject })
  const song = useProject({ snapshot: studio.snapshot, initialProject, onSwitchProject })
  const { pattern, voice } = studio
  const rec = useBeatRecorder({
    pattern,
    beatVolume: studio.beatVolume,
    nextName: () => nextTakeName(studio.takes),
    onRecorded: studio.addTake,
    beforeStart: studio.stop,
  })
  const recordingActive = rec.status === 'counting' || rec.status === 'recording'
  const total = voice ? planStart(studio.offset).voiceDelay + voice.buffer.duration : 0
  const maxOffset = voice ? Math.min(MAX_OFFSET, Math.max(5, Math.ceil(voice.buffer.duration))) : 5

  return (
    <div className="studio">
      <section className="card" aria-labelledby="song-heading">
        <div className="studio-head">
          <h2 id="song-heading">Song</h2>
          <span className="save-state" data-state={song.saveState} aria-live="polite">
            {SAVE_LABEL[song.saveState]}
          </span>
        </div>
        <div className="song-row">
          <div className="field song-field">
            <label htmlFor="song-name">Name</label>
            <input
              id="song-name"
              className="input"
              type="text"
              maxLength={80}
              value={song.name}
              onChange={(e) => song.setName(e.target.value)}
            />
          </div>
          {song.project ? (
            <button type="button" className="btn btn-secondary" onClick={song.newSong}>
              <Icon name="plus" size={18} />
              New song
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={song.saveAsSong}>
              <Icon name="save" size={18} />
              Save song
            </button>
          )}
        </div>
        <p className="muted hint">
          {song.project
            ? 'Your voice, beat, timing and volumes save automatically on this device.'
            : 'Save this song to keep your voice, beat, timing and volumes together. Find it later in Library.'}
        </p>
      </section>

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
            <p className="muted">
              Record your voice over a beat below, record it on its own, or add an audio file you already have.
            </p>
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
                  disabled={rec.busy}
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
            {studio.selectedTake?.meta?.bpm && (
              <p className="muted hint">
                Recorded over a {studio.selectedTake.meta.bpm} BPM beat. If you change the tempo, the beat moves away from
                your voice.
              </p>
            )}
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

        <fieldset className="plain" disabled={rec.busy}>
        <div className="presets" role="group" aria-label="Beat style">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip-btn" onClick={() => studio.applyPreset(p.id)}>
              {p.name}
            </button>
          ))}
        </div>

        <p className="muted hint">
          Song structure: {pattern.order.map((i) => SECTION_LETTERS[i]).join(' ')} ({pattern.order.length} bars). Change
          the sections and bars in the Beats tool.
        </p>

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
        </fieldset>
      </section>

      <section className="card" aria-labelledby="over-heading">
        <h2 id="over-heading">Record over the beat</h2>
        <p className="notice">
          <Icon name="headphones" size={18} />
          <span>Wear headphones. Without them the beat leaks into your microphone and ends up in your recording.</span>
        </p>

        {rec.status === 'idle' ? (
          <button type="button" className="btn btn-primary over-enable" onClick={rec.enable}>
            <Icon name="mic" size={18} />
            Enable microphone
          </button>
        ) : (
          <>
            <div className="field">
              <label htmlFor="over-input">Input</label>
              <select
                id="over-input"
                value={rec.deviceId}
                disabled={rec.busy}
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

            <label className="check">
              <input
                type="checkbox"
                checked={rec.countIn}
                disabled={rec.busy}
                onChange={(e) => rec.changeCountIn(e.target.checked)}
              />
              Count in one bar before the beat starts
            </label>

            <details className="sync">
              <summary>Timing fix</summary>
              <div className="field">
                <label htmlFor="over-sync">
                  Voice sync {rec.syncMs > 0 ? '+' : ''}
                  {rec.syncMs} ms
                </label>
                <input
                  id="over-sync"
                  type="range"
                  min={MIN_SYNC_MS}
                  max={MAX_SYNC_MS}
                  step="5"
                  value={rec.syncMs}
                  disabled={rec.busy}
                  onChange={(e) => rec.changeSync(e.target.value)}
                />
              </div>
              <p className="muted hint">
                If your voice sounds late against the beat, move this up. If it sounds early, move it down. Then record
                again. Wired headphones give the best timing because Bluetooth adds delay.
              </p>
            </details>

            <div className="over-controls">
              <time className="over-time">{formatDuration(rec.elapsed)}</time>
              <p className="over-status" aria-live="polite">
                {RECORDER_STATUS[rec.status]}
              </p>
              <button
                type="button"
                className={recordingActive ? 'rec-btn rec-btn-stop' : 'rec-btn'}
                disabled={rec.status === 'saving'}
                onClick={recordingActive ? rec.stop : rec.start}
              >
                <Icon name={recordingActive ? 'stop' : 'record'} size={20} />
                {recordingActive ? 'Stop recording' : 'Start recording'}
              </button>
            </div>
          </>
        )}

        {rec.error && (
          <p className="alert" role="alert">
            {rec.error}
          </p>
        )}
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
          disabled={!voice || rec.busy}
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
