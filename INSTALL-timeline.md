# Timeline batch 1: keyboard, follow the playhead, live snapping, tidier controls

Nothing in this zip replaces a file of yours. Eight files are brand new, and three of YOUR files get a few
lines pasted in (steps 3, 4 and 5).

## 1. Check first, then copy
Run this from your project folder BEFORE copying. Every line should say "new". If any says EXISTS, stop and tell me.

    $files = "src/tools/timeline/shortcuts.js","src/tools/timeline/shortcuts.test.js","src/tools/timeline/useTimelineKeys.js","src/tools/timeline/useTimelineKeys.test.jsx","src/tools/timeline/follow.js","src/tools/timeline/follow.test.js","src/tools/timeline/useFollowPlayhead.js"
    foreach ($f in $files) { if (Test-Path $f) { "EXISTS  $f" } else { "new     $f" } }

Then unzip into the project root. `git status --short` should list only those files.

## 2. New files
    src/tools/timeline/shortcuts.js          + shortcuts.test.js
    src/tools/timeline/useTimelineKeys.js    + useTimelineKeys.test.jsx
    src/tools/timeline/follow.js             + follow.test.js
    src/tools/timeline/useFollowPlayhead.js

## 3. Edit src/tools/timeline/TimelineView.jsx  (three small pastes)

a) At the very top, with the other imports, add:

    import { useRef } from 'react'
    import { useFollowPlayhead } from './useFollowPlayhead.js'
    import { useTimelineKeys } from './useTimelineKeys.js'

b) In   export function TimelineView({ t }) {   add these three lines as the FIRST lines inside it,
   above   const { timeline, pps, grid } = t

    const scrollRef = useRef(null)
    useTimelineKeys(t)
    useFollowPlayhead(t, scrollRef)

c) Find   <div className="tl-scroll">   and change it to:

    <div className="tl-scroll" ref={scrollRef}>

## 4. Edit src/tools/timeline/ClipView.jsx  (one replacement)

Find this block:

    let style = {}
    if (drag?.mode === 'move') style = { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 5 }
    if (drag?.mode === 'left') {
      left += Math.min(drag.dx, width - 4)
      width = Math.max(4, width - drag.dx)
    }
    if (drag?.mode === 'right') width = Math.max(4, width + drag.dx)

and replace it with:

    let style = {}
    // While dragging, show where the clip will land: snapped to the grid, the same as when you let go.
    const snapped = (from) => timeToPx(draggedStart(from, drag.dx, pps, timeline.bpm, grid) - from, pps)
    if (drag?.mode === 'move') style = { transform: `translate(${snapped(clip.start)}px, ${drag.dy}px)`, zIndex: 5 }
    if (drag?.mode === 'left') {
      const shift = snapped(clip.start)
      left += Math.min(shift, width - 4)
      width = Math.max(4, width - shift)
    }
    if (drag?.mode === 'right') width = Math.max(4, width + snapped(clipEnd(clip, timeline.bpm)))

(draggedStart, timeToPx and clipEnd are already imported at the top of that file.)

## 5. Edit src/tools/timeline/timeline.css  (paste at the very end)

    /* ---- tidier transport: the clock and bars side by side, and a styled Snap control ---- */
    .tl-readout {
      display: flex;
      align-items: baseline;
      gap: var(--s2);
    }
    .tl-readout span {
      color: var(--text-3);
      font-size: 14px;
      font-weight: 600;
    }
    .timeline-tool .field {
      display: flex;
      align-items: center;
      gap: var(--s2);
    }
    .timeline-tool .field label {
      color: var(--text-2);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .timeline-tool .field select {
      height: 40px;
      padding: 0 var(--s3);
      border: 1px solid var(--border-strong, var(--border));
      border-radius: var(--radius);
      background: var(--surface-2);
      color: var(--text);
    }

## 6. Check
    npx vitest run src/tools/timeline
    npm run dev

Try it: add a beat, then press Space (play and pause), S (split), Delete, Ctrl+Z, + and -.
Zoom in and play: the view should follow the playhead. Drag a clip: it should jump from line to line.
