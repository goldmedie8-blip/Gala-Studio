import { Icon } from '../design/Icon.jsx'
import { IconButton } from '../design/IconButton.jsx'

// Transport shell. The controls stay disabled until the audio engine lands in Stage 2.
export function PlayerBar() {
  return (
    <section className="player" aria-label="Player">
      <div className="player-track">
        <span className="player-art">
          <Icon name="music" size={20} />
        </span>
        <div className="player-meta">
          <p className="player-title">Nothing playing</p>
          <p className="player-sub">Open a project to start</p>
        </div>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <IconButton icon="skip-back" label="Previous" disabled />
          <IconButton icon="play" label="Play" primary disabled />
          <IconButton icon="skip-forward" label="Next" disabled />
        </div>
        <div className="player-progress">
          <span className="time">0:00</span>
          <div
            className="progress"
            role="progressbar"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
          />
          <span className="time">0:00</span>
        </div>
      </div>

      <div className="player-right">
        <Icon name="volume" size={18} />
        <div className="volume" aria-hidden="true" />
      </div>
    </section>
  )
}
