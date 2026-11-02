import { useEffect, useState } from 'react'
import { DELAY_TIMES, MASTER_PRESETS, MAX_BOOST, VOCAL_PRESETS } from '../../engine/effects.js'
import { EQ_BANDS } from '../../engine/mixer.js'
import { EQ_RANGE, MAX_VOLUME } from '../../engine/timeline.js'

const dbText = (gain) => (gain <= 0.001 ? '-inf dB' : `${(20 * Math.log10(gain)).toFixed(1)} dB`)
const panText = (pan) => (Math.abs(pan) < 0.02 ? 'C' : `${pan < 0 ? 'L' : 'R'}${Math.round(Math.abs(pan) * 100)}`)

// Level meters redraw about 20 times a second while playing.
function useLevels(t) {
  const [levels, setLevels] = useState(null)
  const playing = t.playState === 'playing'
  useEffect(() => {
    if (!playing) {
      setLevels(null)
      return undefined
    }
    const timer = setInterval(() => setLevels(t.getLevels()), 50)
    return () => clearInterval(timer)
  }, [playing, t])
  return levels
}

function Meter({ level, name }) {
  return (
    <div className="mx-meter" role="meter" aria-label={`Level, ${name}`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number((level?.level ?? 0).toFixed(2))}>
      <div className="mx-meter-fill" data-clipping={Boolean(level?.clipping)} style={{ height: `${Math.round((level?.level ?? 0) * 100)}%` }} />
    </div>
  )
}

function Strip({ track, t, level }) {
  const set = (patch) => t.setTrackValue(track.id, patch)
  return (
    <div className="mx-strip" data-kind={track.kind}>
      <strong className="mx-name">{track.name}</strong>

      <div className="mx-buttons">
        <button type="button" className="mini-toggle" aria-pressed={track.mute} aria-label={`Mute ${track.name}`} onClick={() => set({ mute: !track.mute })}>
          M
        </button>
        <button type="button" className="mini-toggle" data-solo="true" aria-pressed={track.solo} aria-label={`Solo ${track.name}`} onClick={() => set({ solo: !track.solo })}>
          S
        </button>
      </div>

      <div className="mx-fader">
        <Meter level={level} name={track.name} />
        <input
          className="mx-volume"
          type="range"
          min="0"
          max={MAX_VOLUME}
          step="0.01"
          value={track.volume}
          aria-label={`Volume, ${track.name}`}
          onChange={(e) => set({ volume: Number(e.target.value) })}
        />
      </div>
      <span className="mx-value">{dbText(track.volume)}</span>

      <label className="mx-control">
        <span>Pan</span>
        <input type="range" min="-1" max="1" step="0.05" value={track.pan} aria-label={`Pan, ${track.name}`} onChange={(e) => set({ pan: Number(e.target.value) })} />
        <em>{panText(track.pan)}</em>
      </label>

      {EQ_BANDS.map((band) => (
        <label key={band.id} className="mx-control">
          <span>{band.name}</span>
          <input
            type="range"
            min={-EQ_RANGE}
            max={EQ_RANGE}
            step="1"
            value={track.eq[band.id]}
            aria-label={`${band.name} EQ, ${track.name}`}
            onChange={(e) => set({ eq: { [band.id]: Number(e.target.value) } })}
          />
          <em>{track.eq[band.id] > 0 ? '+' : ''}{track.eq[band.id]} dB</em>
        </label>
      ))}

      <label className="mx-control">
        <span>Reverb</span>
        <input type="range" min="0" max="1" step="0.05" value={track.reverb} aria-label={`Reverb send, ${track.name}`} onChange={(e) => set({ reverb: Number(e.target.value) })} />
        <em>{Math.round(track.reverb * 100)}%</em>
      </label>

      <div className="mx-fx" role="group" aria-label={`Effects, ${track.name}`}>
        <label className="mx-control">
          <span>Effects preset</span>
          <select
            aria-label={`Effects preset, ${track.name}`}
            value=""
            onChange={(e) => {
              const preset = VOCAL_PRESETS.find((p) => p.id === e.target.value)
              if (preset) set(preset.values)
            }}
          >
            <option value="">Choose...</option>
            {VOCAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {[
          ['comp', 'Compressor', 'Compressor'],
          ['softS', 'De-esser', 'De-esser'],
          ['double', 'Double', 'Doubler'],
          ['delay', 'Echo', 'Echo'],
        ].map(([key, label, aria]) => (
          <label key={key} className="mx-control">
            <span>{label}</span>
            <input type="range" min="0" max="1" step="0.05" value={track[key]} aria-label={`${aria}, ${track.name}`} onChange={(e) => set({ [key]: Number(e.target.value) })} />
            <em>{Math.round(track[key] * 100)}%</em>
          </label>
        ))}
        <label className="mx-control">
          <span>Echo timing</span>
          <select aria-label={`Echo timing, ${track.name}`} value={track.delayTime} onChange={(e) => set({ delayTime: e.target.value })}>
            {DELAY_TIMES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

const lufsText = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} LUFS` : 'silent')

// Makes the whole song loud and safe: a style, how loud, a check against what streaming services want.
function Mastering({ t }) {
  const { master } = t.timeline
  const preset = MASTER_PRESETS[master.preset]
  const [reduction, setReduction] = useState(0)
  const playing = t.playState === 'playing'
  useEffect(() => {
    if (!playing) {
      setReduction(0)
      return undefined
    }
    const timer = setInterval(() => setReduction(t.getReduction()), 80)
    return () => clearInterval(timer)
  }, [playing, t])

  const result = t.loudness
  const gap = result && Number.isFinite(result.lufs) && preset.target !== null ? result.lufs - preset.target : null
  return (
    <section className="card mx-mastering" aria-label="Mastering">
      <h3>Mastering</h3>
      <p className="muted">Evens out the whole song, makes it as loud as other songs, and stops it from distorting.</p>
      <div className="mx-master-row">
        <label className="mx-control">
          <span>Style</span>
          <select aria-label="Mastering style" value={master.preset} onChange={(e) => t.setMastering({ preset: e.target.value, boost: 0 })}>
            {Object.entries(MASTER_PRESETS).map(([id, p]) => (
              <option key={id} value={id}>
                {p.name}
                {p.target !== null ? ` (${p.target} LUFS)` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="mx-control">
          <span>Loudness boost</span>
          <input type="range" min="0" max={MAX_BOOST} step="0.5" disabled={preset.target === null} value={master.boost} aria-label="Loudness boost" onChange={(e) => t.setMastering({ boost: Number(e.target.value) })} />
          <em>+{master.boost.toFixed(1)} dB</em>
        </label>
        <div className="mx-reduction" role="meter" aria-label="Limiter working" aria-valuemin={0} aria-valuemax={12} aria-valuenow={Number(Math.min(12, reduction).toFixed(1))}>
          <span>Limiter</span>
          <strong>{reduction > 0.2 ? `-${reduction.toFixed(1)} dB` : 'idle'}</strong>
        </div>
      </div>
      <div className="mx-master-row">
        <button type="button" className="btn btn-secondary" onClick={t.checkLoudness} disabled={t.loudness?.busy}>
          Check loudness
        </button>
        <button type="button" className="btn btn-primary" onClick={t.matchLoudness} disabled={preset.target === null || t.loudness?.busy}>
          Match target loudness
        </button>
      </div>
      {result?.busy && <p role="status">Measuring the song...</p>}
      {result && !result.busy && (
        <p role="status" className="mx-result">
          Loudness: <strong>{lufsText(result.lufs)}</strong>. Loudest peak: {Number.isFinite(result.peakDb) ? `${result.peakDb.toFixed(1)} dB` : 'none'}.{' '}
          {gap === null
            ? 'Pick a mastering style to compare with a target.'
            : Math.abs(gap) < 1
              ? `On target for ${preset.name} (${preset.target} LUFS).`
              : gap > 0
                ? `${gap.toFixed(1)} dB louder than the ${preset.name} target. Lower the boost.`
                : `${(-gap).toFixed(1)} dB quieter than the ${preset.name} target. Press Match target loudness.`}
        </p>
      )}
    </section>
  )
}

export function MixerView({ t }) {
  const levels = useLevels(t)
  const { timeline } = t
  return (
    <>
    <section className="card mx" aria-label="Mixer">
      <div className="mx-strips">
        {timeline.tracks.map((track) => (
          <Strip key={track.id} track={track} t={t} level={levels?.tracks[track.id]} />
        ))}
        <div className="mx-strip mx-master">
          <strong className="mx-name">Master</strong>
          <div className="mx-fader">
            <Meter level={levels?.master} name="Master" />
            <input
              className="mx-volume"
              type="range"
              min="0"
              max={MAX_VOLUME}
              step="0.01"
              value={timeline.masterVolume}
              aria-label="Master volume"
              onChange={(e) => t.setMaster(Number(e.target.value))}
            />
          </div>
          <span className="mx-value">{dbText(timeline.masterVolume)}</span>
        </div>
      </div>
      {timeline.tracks.length === 0 && <p className="muted">Add a track in the Timeline view and it appears here.</p>}
    </section>
    <Mastering t={t} />
    </>
  )
}
