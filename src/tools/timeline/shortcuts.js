// Keyboard shortcuts for the Timeline. Deciding which key means what is pure, so it can be tested without a
// browser; useTimelineKeys.js only attaches it.
//
//   Space play or pause        Home  go to the start        L  loop        M  metronome
//   S  split at the playhead   D  duplicate the clip        Delete / Backspace  delete the clip
//   Left / Right  nudge the clip by one grid step           [ and ]  trim the clip to the playhead
//   + and -  zoom              Ctrl or Cmd + Z  undo        Ctrl or Cmd + Shift + Z, or Ctrl + Y  redo

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const PRESSABLE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY'])
const PRESSABLE_ROLES = new Set(['button', 'link', 'slider', 'checkbox', 'radio', 'switch', 'tab', 'menuitem'])

// Keys typed into a text box, a number box or a menu belong to that control, never to the timeline.
export const isTyping = (target) => Boolean(target) && (TYPING.has(target.tagName) || target.isContentEditable === true)

// Space and Enter already "press" a button or link that has focus, so Space must not also start playback then.
const isPressable = (target) =>
  Boolean(target) && (PRESSABLE_TAGS.has(target.tagName) || PRESSABLE_ROLES.has(target.getAttribute?.('role')))

// The name of what a key press means for the timeline, or null if it means nothing here.
export function shortcutFor(event) {
  if (event.defaultPrevented || event.isComposing) return null
  if (isTyping(event.target)) return null
  const { key } = event

  if (event.ctrlKey || event.metaKey) {
    if (event.altKey) return null
    const letter = key.toLowerCase()
    if (letter === 'z') return event.shiftKey ? 'redo' : 'undo'
    if (letter === 'y') return 'redo'
    return null // Ctrl+S, Ctrl+D and the rest stay with the browser
  }
  if (event.altKey) return null

  switch (key) {
    case ' ':
      return isPressable(event.target) ? null : 'togglePlay'
    case 'Home':
      return 'goToStart'
    case 'Delete':
    case 'Backspace':
      return 'delete'
    case 'ArrowLeft':
      return 'nudgeBack'
    case 'ArrowRight':
      return 'nudgeForward'
    case '+':
    case '=':
      return 'zoomIn'
    case '-':
    case '_':
      return 'zoomOut'
    case '[':
      return 'trimStart'
    case ']':
      return 'trimEnd'
    default:
      break
  }
  switch (key.toLowerCase()) {
    case 's':
      return 'split'
    case 'd':
      return 'duplicate'
    case 'l':
      return 'loop'
    case 'm':
      return 'metronome'
    default:
      return null
  }
}

// Does what a shortcut says on the timeline. Returns true if something was done, so the key press can be
// kept from also doing its normal browser job (scrolling the page, for example).
export function runShortcut(action, t) {
  const hasClip = Boolean(t.selected)
  switch (action) {
    case 'togglePlay':
      t.togglePlay()
      return true
    case 'goToStart':
      t.goToStart()
      return true
    case 'undo':
      if (!t.canUndo) return false
      t.undo()
      return true
    case 'redo':
      if (!t.canRedo) return false
      t.redo()
      return true
    case 'zoomIn':
      t.setZoom((z) => z + 1)
      return true
    case 'zoomOut':
      t.setZoom((z) => z - 1)
      return true
    case 'loop':
      t.toggleLoop()
      return true
    case 'metronome':
      t.toggleMetronome()
      return true
    case 'delete':
      if (!hasClip) return false
      t.deleteSelected()
      return true
    case 'split':
      if (!hasClip) return false
      t.splitAtPlayhead()
      return true
    case 'duplicate':
      if (!hasClip) return false
      t.duplicateSelected()
      return true
    case 'nudgeBack':
      if (!hasClip) return false
      t.nudgeSelected(-1)
      return true
    case 'nudgeForward':
      if (!hasClip) return false
      t.nudgeSelected(1)
      return true
    case 'trimStart':
      if (!hasClip) return false
      t.trimStartToPlayhead()
      return true
    case 'trimEnd':
      if (!hasClip) return false
      t.trimEndToPlayhead()
      return true
    default:
      return false
  }
}
