import { BEATS_PER_BAR } from '../../engine/notes.js'
import { noteLabel } from '../../engine/piano.js'

// The recorded part as a picture: time goes right, higher notes go up. Press a note to remove it.
export function NoteRoll({ notes, bars, position, mode, onRemove }) {
  const total = bars * BEATS_PER_BAR
  const low = notes.length ? Math.min(...notes.map((n) => n.midi)) : 55
  const high = notes.length ? Math.max(...notes.map((n) => n.midi)) : 79
  const span = Math.max(12, high - low + 1)
  const bottom = low - Math.max(0, Math.floor((span - (high - low + 1)) / 2))
  return (
    <div className="pn-roll" style={{ '--beats': total, '--bars': bars }} role="group" aria-label="Recorded notes">
      {notes.length === 0 && <p className="pn-roll-hint muted">Nothing recorded yet. Press Record, then play.</p>}
      {notes.map((n, i) => (
        <button
          key={`${n.midi}-${n.start}-${i}`}
          type="button"
          className="pn-note"
          aria-label={`Remove note ${noteLabel(n.midi)} at beat ${(n.start + 1).toFixed(2)}`}
          style={{
            left: `${(n.start / total) * 100}%`,
            width: `${Math.max(0.8, (n.length / total) * 100)}%`,
            bottom: `${((n.midi - bottom) / span) * 100}%`,
            height: `${100 / span}%`,
          }}
          onClick={() => onRemove(i)}
        />
      ))}
      {mode !== 'idle' && position >= 0 && <span className="pn-cursor" style={{ left: `${(position / total) * 100}%` }} aria-hidden="true" />}
    </div>
  )
}
