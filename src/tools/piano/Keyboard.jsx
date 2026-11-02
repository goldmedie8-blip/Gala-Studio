import { COMPUTER_KEYS, isBlackKey, noteLabel } from '../../engine/piano.js'

const WHITE_KEYS = 15 // two octaves and the next C

// An on-screen keyboard. Press a key to play it; lower on the key is louder.
export function Keyboard({ base, held, onDown, onUp, inKey }) {
  const midis = Array.from({ length: 25 }, (_, i) => base + i)
  const whites = midis.filter((m) => !isBlackKey(m))
  const keyFor = Object.fromEntries(Object.entries(COMPUTER_KEYS).map(([k, v]) => [base + v, k.toUpperCase()]))

  const press = (midi) => (event) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const along = rect.height ? (event.clientY - rect.top) / rect.height : 0.7
    onDown(midi, Math.min(1, Math.max(0.3, 0.35 + along * 0.65)))
  }
  const release = (midi) => () => onUp(midi)

  const props = (midi) => ({
    type: 'button',
    'aria-label': `Piano key ${noteLabel(midi)}`,
    'aria-pressed': held.has(midi),
    'data-in-key': inKey ? inKey(midi) : undefined,
    onPointerDown: press(midi),
    onPointerUp: release(midi),
    onPointerLeave: release(midi),
    onPointerCancel: release(midi),
    onContextMenu: (e) => e.preventDefault(),
  })

  return (
    <div className="pn-keys" role="group" aria-label="Piano keyboard" style={{ '--whites': WHITE_KEYS }}>
      {whites.map((midi, i) => {
        const black = midis.includes(midi + 1) && isBlackKey(midi + 1) ? midi + 1 : null
        return (
          <div key={midi} className="pn-white-wrap">
            <button {...props(midi)} className="pn-white">
              <span className="pn-key-label">{noteLabel(midi).startsWith('C') && !noteLabel(midi).includes('#') ? noteLabel(midi) : keyFor[midi] ?? ''}</span>
            </button>
            {black !== null && i < WHITE_KEYS - 1 && <button {...props(black)} className="pn-black" />}
          </div>
        )
      })}
    </div>
  )
}
