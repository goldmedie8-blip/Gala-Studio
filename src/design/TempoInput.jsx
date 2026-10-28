import { useEffect, useState } from 'react'
import { MAX_BPM, MIN_BPM } from '../engine/pattern.js'

// A tempo box you can actually type in. It keeps what you are typing separate from the real tempo,
// so clearing the box or typing "1" on the way to "120" does not snap the tempo to something else.
// The tempo updates as soon as what you typed is a valid tempo, and is tidied up when you leave the box.
export function TempoInput({ value, onChange, label = 'Tempo in beats per minute' }) {
  const [draft, setDraft] = useState(null) // null means show the real tempo

  useEffect(() => setDraft(null), [value])

  return (
    <input
      type="number"
      inputMode="numeric"
      min={MIN_BPM}
      max={MAX_BPM}
      value={draft ?? value}
      aria-label={label}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        const n = Number(text)
        if (text !== '' && n >= MIN_BPM && n <= MAX_BPM) onChange(n)
      }}
      onBlur={(e) => {
        const text = e.target.value
        if (text !== '' && Number.isFinite(Number(text))) onChange(Number(text)) // out-of-range values are clamped
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
