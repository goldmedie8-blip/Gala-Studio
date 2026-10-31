import { useEffect, useState } from 'react'
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
    </div>
  )
}

export function MixerView({ t }) {
  const levels = useLevels(t)
  const { timeline } = t
  return (
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
  )
}
