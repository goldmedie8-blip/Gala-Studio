import { useRef, useState } from 'react'
import { SECTION_LETTERS } from '../../engine/pattern.js'
import { barSeconds, clipDuration, clipEnd } from '../../engine/timeline.js'
import { draggedStart, timeToPx, waveformPath } from './geometry.js'

const CLIP_HEIGHT = 56
const MIN_DRAG_PX = 3

// One clip on a track. Press and drag to move it, drag its ends to trim it. Touch screens need the clip
// selected first, so that touching a clip to scroll the timeline does not move it by accident.
export function ClipView({ clip, track, t }) {
  const { timeline, pps, grid } = t
  const duration = clipDuration(clip, timeline.bpm)
  const selected = t.selectedClipId === clip.id
  const isBeat = Boolean(clip.bars)
  const missing = !isBeat && t.audio.isMissing(clip.takeId)
  const [drag, setDrag] = useState(null) // { mode, dx, dy }
  const startRef = useRef(null)

  const begin = (mode) => (event) => {
    if (event.button !== undefined && event.button > 0) return
    event.stopPropagation()
    t.select(clip.id, track.id)
    if (event.pointerType === 'touch' && !selected && mode === 'move') return
    startRef.current = { mode, x: event.clientX, y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ mode, dx: 0, dy: 0 })
  }

  const move = (event) => {
    const s = startRef.current
    if (!s) return
    const dx = event.clientX - s.x
    const dy = event.clientY - s.y
    if (Math.abs(dx) + Math.abs(dy) > MIN_DRAG_PX) s.moved = true
    setDrag({ mode: s.mode, dx, dy })
  }

  const end = (event) => {
    const s = startRef.current
    startRef.current = null
    setDrag(null)
    if (!s?.moved) return
    const dx = event.clientX - s.x
    if (s.mode === 'move') {
      const start = draggedStart(clip.start, dx, pps, timeline.bpm, grid)
      const over = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-track-id]')
      const trackId = over?.dataset.trackId
      t.moveClip(clip.id, { start, ...(trackId && trackId !== track.id ? { trackId } : {}) })
    } else if (s.mode === 'left') {
      t.trimStart(clip.id, draggedStart(clip.start, dx, pps, timeline.bpm, grid))
    } else {
      t.trimEnd(clip.id, draggedStart(clipEnd(clip, timeline.bpm), dx, pps, timeline.bpm, grid))
    }
  }

  // What is shown while dragging, before the change is made.
  let left = timeToPx(clip.start, pps)
  let width = Math.max(4, timeToPx(duration, pps))
  let style = {}
  if (drag?.mode === 'move') style = { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 5 }
  if (drag?.mode === 'left') {
    left += Math.min(drag.dx, width - 4)
    width = Math.max(4, width - drag.dx)
  }
  if (drag?.mode === 'right') width = Math.max(4, width + drag.dx)

  const peaks = isBeat ? null : t.audio.getPeaks(clip.takeId)
  const path = peaks ? waveformPath(peaks, clip.offset / clip.source, (clip.offset + clip.length) / clip.source, Math.max(1, width), CLIP_HEIGHT) : ''
  const bar = timeToPx(barSeconds(timeline.bpm), pps)

  const label = `${clip.name}, ${track.name}, starts at ${clip.start.toFixed(1)} seconds`
  return (
    <div
      className="tl-clip"
      data-kind={isBeat ? 'beat' : 'audio'}
      data-selected={selected}
      data-dragging={Boolean(drag?.moved ?? drag)}
      data-missing={missing}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={label}
      style={{ left, width, ...style, '--bar': `${bar}px` }}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => {
        startRef.current = null
        setDrag(null)
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          t.select(clip.id, track.id)
        }
      }}
    >
      <span className="tl-handle tl-handle-left" aria-hidden="true" onPointerDown={begin('left')} onPointerMove={move} onPointerUp={end} />
      {path && (
        <svg className="tl-wave" width={width} height={CLIP_HEIGHT} viewBox={`0 0 ${width} ${CLIP_HEIGHT}`} aria-hidden="true" preserveAspectRatio="none">
          <path d={path} />
        </svg>
      )}
      {isBeat && (
        <span className="tl-sections" aria-hidden="true">
          {Array.from({ length: clip.bars }, (_, i) => (
            <span key={i}>{SECTION_LETTERS[clip.pattern.order[i % clip.pattern.order.length]]}</span>
          ))}
        </span>
      )}
      <span className="tl-clip-name">{missing ? `${clip.name} (recording missing)` : clip.name}</span>
      <span className="tl-handle tl-handle-right" aria-hidden="true" onPointerDown={begin('right')} onPointerMove={move} onPointerUp={end} />
    </div>
  )
}
