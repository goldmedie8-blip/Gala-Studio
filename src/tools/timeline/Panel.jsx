import { Icon } from '../../design/Icon.jsx'
import { AddPanel } from './AddPanel.jsx'
import { ClipToolbar } from './ClipToolbar.jsx'
import { MixerView } from './MixerView.jsx'
import { TimelineView } from './TimelineView.jsx'
import { TransportBar } from './TransportBar.jsx'
import './timeline.css'
import { useTimeline } from './useTimeline.js'

const typing = (target) => /^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName) || target?.isContentEditable

export default function Panel() {
  const t = useTimeline()

  if (t.loading) return <p className="muted">Opening your song...</p>

  // Keyboard shortcuts, for people with a laptop keyboard. Typing in a box never triggers them.
  const onKeyDown = (event) => {
    if (typing(event.target)) return
    const mod = event.ctrlKey || event.metaKey
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      event.shiftKey ? t.redo() : t.undo()
    } else if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      t.redo()
    } else if (event.key === ' ' && event.target.tagName !== 'BUTTON') {
      event.preventDefault()
      t.togglePlay()
    } else if (event.key === 'Home') {
      t.goToStart()
    } else if (event.key.toLowerCase() === 's' && !mod) {
      t.splitAtPlayhead()
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && t.selectedClipId) {
      event.preventDefault()
      t.deleteSelected()
    } else if (event.key === 'ArrowLeft' && t.selectedClipId) {
      event.preventDefault()
      t.nudgeSelected(-1)
    } else if (event.key === 'ArrowRight' && t.selectedClipId) {
      event.preventDefault()
      t.nudgeSelected(1)
    }
  }

  return (
    <div className="timeline-tool" onKeyDown={onKeyDown}>
      <TransportBar t={t} />

      {t.error && (
        <p className="alert" role="alert">
          {t.error}
        </p>
      )}

      <div className="tl-view-bar">
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={t.view === 'timeline'} onClick={() => t.setView('timeline')}>
            <Icon name="list" size={16} />
            Timeline
          </button>
          <button type="button" aria-pressed={t.view === 'mixer'} onClick={() => t.setView('mixer')}>
            <Icon name="sliders" size={16} />
            Mixer
          </button>
        </div>
        {t.song && <span className="muted tl-song">Song: {t.song.name}</span>}
      </div>

      {t.view === 'timeline' ? (
        <>
          <TimelineView t={t} />
          <ClipToolbar t={t} />
          <AddPanel t={t} />
        </>
      ) : (
        <MixerView t={t} />
      )}
    </div>
  )
}
