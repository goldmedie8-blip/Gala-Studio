import { Icon } from '../../design/Icon.jsx'
import { barSeconds, timelineDuration } from '../../engine/timeline.js'
import { ClipView } from './ClipView.jsx'
import { HEADER_WIDTH, TAIL_SECONDS, gridUnit, pxToTime, rulerMarks, timeToPx } from './geometry.js'
import { usePlayhead } from './usePlayhead.js'

function Playhead({ t }) {
  const position = usePlayhead(t.getPosition, t.playState === 'playing', t.seekTick)
  return <div className="tl-playhead" style={{ left: HEADER_WIDTH + timeToPx(position, t.pps) }} aria-hidden="true" />
}

function TrackHeader({ track, t }) {
  const selected = t.selectedTrackId === track.id
  return (
    <div className="tl-header" data-selected={selected} onClick={() => t.selectTrack(track.id)}>
      <div className="tl-header-top">
        <Icon name={track.kind === 'beat' ? 'drum' : 'mic'} size={16} />
        <input
          className="tl-name"
          type="text"
          maxLength={40}
          value={track.name}
          aria-label={`Name of ${track.kind} track ${track.name}`}
          onFocus={() => t.selectTrack(track.id)}
          onChange={(e) => t.rename(track.id, e.target.value)}
        />
      </div>
      <div className="tl-header-buttons">
        <button
          type="button"
          className="mini-toggle"
          aria-pressed={track.mute}
          aria-label={`Mute ${track.name}`}
          onClick={(e) => {
            e.stopPropagation()
            t.setTrackValue(track.id, { mute: !track.mute })
          }}
        >
          M
        </button>
        <button
          type="button"
          className="mini-toggle"
          data-solo="true"
          aria-pressed={track.solo}
          aria-label={`Solo ${track.name}`}
          onClick={(e) => {
            e.stopPropagation()
            t.setTrackValue(track.id, { solo: !track.solo })
          }}
        >
          S
        </button>
      </div>
    </div>
  )
}

export function TimelineView({ t }) {
  const { timeline, pps, grid } = t
  const duration = timelineDuration(timeline)
  const width = Math.max(timeToPx(duration + TAIL_SECONDS, pps), 480)
  const marks = rulerMarks(duration + TAIL_SECONDS, timeline.bpm, pps)
  const bar = timeToPx(barSeconds(timeline.bpm), pps)
  const unit = gridUnit(timeline.bpm, grid)
  const { loop } = timeline

  const seekFromRuler = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const raw = pxToTime(event.clientX - rect.left, pps)
    t.seek(unit ? Math.round(raw / unit) * unit : raw)
  }

  if (timeline.tracks.length === 0) {
    return (
      <section className="card tl-empty">
        <h2>No tracks yet</h2>
        <p className="muted">Add a beat track for drums and bass, and an audio track for your voice or an instrument.</p>
        <div className="tl-group">
          <button type="button" className="btn btn-primary" onClick={() => t.addNewTrack('beat')}>
            <Icon name="plus" size={18} />
            Add beat track
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => t.addNewTrack('audio')}>
            <Icon name="plus" size={18} />
            Add audio track
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card tl-card" aria-label="Timeline">
      <div className="tl-scroll">
        <div className="tl-content" style={{ width: HEADER_WIDTH + width, '--bar': `${bar}px` }}>
          <div className="tl-row tl-ruler-row">
            <div className="tl-corner" />
            <button type="button" className="tl-ruler" style={{ width }} aria-label="Ruler. Press a time to move the playhead there." onClick={seekFromRuler}>
              {loop.on && <span className="tl-loop" style={{ left: timeToPx(loop.start, pps), width: timeToPx(loop.end - loop.start, pps) }} />}
              {marks.map((m) => (
                <span key={m.time} className="tl-mark" data-bar={m.bar} style={{ left: timeToPx(m.time, pps) }}>
                  {m.label}
                </span>
              ))}
            </button>
          </div>

          {timeline.tracks.map((track) => (
            <div key={track.id} className="tl-row">
              <TrackHeader track={track} t={t} />
              <div
                className="tl-lane"
                data-track-id={track.id}
                data-kind={track.kind}
                data-selected={t.selectedTrackId === track.id}
                style={{ width }}
                onClick={() => {
                  t.select(null, track.id)
                }}
              >
                {loop.on && <span className="tl-loop" style={{ left: timeToPx(loop.start, pps), width: timeToPx(loop.end - loop.start, pps) }} />}
                {track.clips.length === 0 && (
                  <span className="tl-lane-hint">{track.kind === 'beat' ? 'Add a beat here' : 'Add a recording here'}</span>
                )}
                {track.clips.map((clip) => (
                  <ClipView key={clip.id} clip={clip} track={track} t={t} />
                ))}
              </div>
            </div>
          ))}
          <Playhead t={t} />
        </div>
      </div>
    </section>
  )
}
