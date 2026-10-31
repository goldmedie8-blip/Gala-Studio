import { Icon } from '../../design/Icon.jsx'

// Everything you can do to the clip or track you selected. Every action has a button, so editing works
// on a phone without precise dragging.
export function ClipToolbar({ t }) {
  const clip = t.selected?.clip
  const track = t.timeline.tracks.find((x) => x.id === t.selectedTrackId)

  if (!clip) {
    return (
      <section className="card tl-tools" aria-label="Clip tools">
        <p className="muted">
          Press a clip to edit it. Drag it to move it, or drag its ends to trim it.
        </p>
        {track && (
          <button type="button" className="btn btn-secondary" onClick={() => t.deleteTrack(track.id)}>
            <Icon name="trash" size={18} />
            Delete track {track.name}
          </button>
        )}
      </section>
    )
  }

  return (
    <section className="card tl-tools" aria-label="Clip tools">
      <div className="field tl-tools-name">
        <label htmlFor="tl-clip-name">Clip name</label>
        <input id="tl-clip-name" className="input" type="text" maxLength={60} value={clip.name} onChange={(e) => t.changeClipName(clip.id, e.target.value)} />
      </div>
      <div className="tl-tools-buttons">
        <button type="button" className="btn btn-secondary" onClick={t.splitAtPlayhead}>
          <Icon name="scissors" size={18} />
          Split at playhead
        </button>
        <button type="button" className="btn btn-secondary" onClick={t.duplicateSelected}>
          <Icon name="copy" size={18} />
          Duplicate
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => t.nudgeSelected(-1)}>
          <Icon name="chevron-left" size={18} />
          Move earlier
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => t.nudgeSelected(1)}>
          Move later
          <Icon name="chevron-right" size={18} />
        </button>
        <button type="button" className="btn btn-secondary" onClick={t.trimStartToPlayhead}>
          Trim start to playhead
        </button>
        <button type="button" className="btn btn-secondary" onClick={t.trimEndToPlayhead}>
          Trim end to playhead
        </button>
        <button type="button" className="btn btn-secondary" onClick={t.loopSelection}>
          <Icon name="repeat" size={18} />
          Loop this clip
        </button>
        <button type="button" className="btn btn-secondary" onClick={t.deleteSelected}>
          <Icon name="trash" size={18} />
          Delete clip
        </button>
      </div>
      {!clip.bars && (
        <div className="field tl-tools-gain">
          <label htmlFor="tl-clip-gain">Clip volume</label>
          <input
            id="tl-clip-gain"
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={clip.gain}
            onChange={(e) => t.changeClipGain(clip.id, Number(e.target.value))}
          />
        </div>
      )}
    </section>
  )
}
