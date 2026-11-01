import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../design/Icon.jsx'
import { lineAtTime, lyricLines } from '../../engine/followLyrics.js'
import { adoptDraft, loadLyrics } from '../../storage/lyricsStore.js'
import './studioLyrics.css'

// The words of the song you are working on, shown beside the beat and the recorder. While the song plays, the
// line being sung lights up: lines go one after another from the first bar of the beat.
//
//   projectId  the saved song's id, or null while the song has not been saved yet
//   bpm        the beat's tempo
//   beatTime   seconds since the beat started (negative before it starts)
//   playing    whether the song is playing
export default function StudioLyrics({ projectId, bpm, beatTime, playing }) {
  const [song, setSong] = useState(() => loadLyrics(projectId))
  const [linesPerBar, setLinesPerBar] = useState(1)
  const lastId = useRef(projectId)

  // An unsaved session that has just become a saved song takes its draft lyrics along.
  useEffect(() => {
    if (lastId.current === null && projectId) {
      adoptDraft(projectId)
      setSong(loadLyrics(projectId))
    }
    lastId.current = projectId
  }, [projectId])

  const lines = useMemo(() => lyricLines(song), [song])
  const current = playing ? lineAtTime(lines.length, beatTime, bpm, linesPerBar) : -1

  const listRef = useRef(null)
  useEffect(() => {
    if (current < 0) return
    listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <section className="card" aria-labelledby="studio-lyrics-heading">
      <div className="studio-head">
        <h2 id="studio-lyrics-heading">Lyrics</h2>
        <Link className="btn btn-secondary" to="/lyrics">
          <Icon name="notebook" size={18} />
          Edit lyrics
        </Link>
      </div>

      {lines.length === 0 ? (
        <p className="muted">
          No lyrics for this song yet. Write them in <Link to="/lyrics">Lyrics</Link> and they will show up here.
        </p>
      ) : (
        <>
          <div className="sl-seg" role="group" aria-label="Lines per bar">
            <button type="button" aria-pressed={linesPerBar === 1} onClick={() => setLinesPerBar(1)}>
              1 line a bar
            </button>
            <button type="button" aria-pressed={linesPerBar === 2} onClick={() => setLinesPerBar(2)}>
              2 lines a bar
            </button>
          </div>
          <ol className="sl-lines" aria-label="Lyric lines" ref={listRef}>
            {lines.map((line, i) => (
              <li key={i} className="sl-line" data-current={i === current}>
                {line.first && <span className="sl-section">{line.section}</span>}
                <span className="sl-text">{line.text}</span>
              </li>
            ))}
          </ol>
          <p className="muted sl-hint">
            Press Play and the line for each bar lights up. The lines follow one another from the first bar of the beat.
          </p>
        </>
      )}
    </section>
  )
}
