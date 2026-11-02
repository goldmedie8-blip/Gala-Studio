import { BEATS_PER_BAR } from '../../engine/notes.js'
import { isBlackKey, noteLabel } from '../../engine/piano.js'

export const ROW_PX = 14

// The part as a piano roll: time goes right, higher notes go up. Press an empty spot to add a note, press
// a note to select it and edit it with the buttons below.
export function NoteRoll({ notes, bars, position, mode, selected, onSelect, onAdd, low, high }) {
  const total = bars * BEATS_PER_BAR
  const rows = high - low + 1

  const press = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const beat = ((event.clientX - rect.left) / rect.width) * total
    const midi = high - Math.floor(((event.clientY - rect.top) / rect.height) * rows)
    onAdd(Math.min(high, Math.max(low, midi)), beat)
  }

  return (
    <div className="pn-roll-scroll">
      <div
        className="pn-roll"
        style={{ '--beats': total, '--bars': bars, height: rows * ROW_PX }}
        role="group"
        aria-label="Recorded notes"
        onClick={press}
      >
        {Array.from({ length: rows }, (_, i) => {
          const midi = high - i
          return <span key={midi} className="pn-row" data-black={isBlackKey(midi)} data-c={midi % 12 === 0} style={{ top: i * ROW_PX, height: ROW_PX }} />
        })}
        {notes.length === 0 && <p className="pn-roll-hint muted">Nothing here yet. Press Record and play, or press this grid to place notes.</p>}
        {notes.map((n, i) => (
          <button
            key={`${n.midi}-${n.start}-${i}`}
            type="button"
            className="pn-note"
            data-selected={selected === i}
            aria-pressed={selected === i}
            aria-label={`Note ${noteLabel(n.midi)} at beat ${(n.start + 1).toFixed(2)}`}
            style={{
              left: `${(n.start / total) * 100}%`,
              width: `${Math.max(0.8, (n.length / total) * 100)}%`,
              top: (high - n.midi) * ROW_PX,
              height: ROW_PX - 1,
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(i)
            }}
          />
        ))}
        {mode !== 'idle' && position >= 0 && <span className="pn-cursor" style={{ left: `${(position / total) * 100}%` }} aria-hidden="true" />}
      </div>
    </div>
  )
}
