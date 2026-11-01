import { useMemo, useState } from 'react'
import { Icon } from '../../design/Icon.jsx'
import {
  LANGUAGES,
  MAX_SECTIONS,
  SECTION_TYPES,
  analyzeSection,
  findRhymes,
  sectionNames,
  wordsIn,
} from '../../engine/lyrics.js'
import './lyrics.css'
import { useLyrics } from './useLyrics.js'

function SectionCard({ section, name, index, count, language, onEdit, onMove, onRemove }) {
  const lines = useMemo(() => analyzeSection(section.text, language), [section.text, language])
  const rows = Math.max(4, section.text.split('\n').length + 1)

  return (
    <section className="card ly-section" aria-label={name}>
      <header className="ly-section-head">
        <h2 className="ly-section-name">{name}</h2>
        <div className="ly-section-tools">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => onMove(section.id, -1)}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Move ${name} down`}
            disabled={index === count - 1}
            onClick={() => onMove(section.id, 1)}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ${name}`}
            disabled={count <= 1}
            onClick={() => onRemove(section.id)}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      </header>

      <input
        className="ly-chords"
        type="text"
        value={section.chords}
        placeholder="Chords, for example Am F C G"
        aria-label={`${name} chords`}
        onChange={(e) => onEdit(section.id, { chords: e.target.value })}
      />

      <textarea
        className="ly-text"
        rows={rows}
        value={section.text}
        placeholder="Write one line per row."
        aria-label={`${name} lyrics`}
        onChange={(e) => onEdit(section.id, { text: e.target.value })}
      />

      {lines.length > 0 && (
        <ol className="ly-lines" aria-label={`${name} line check`}>
          {lines.map((row) => (
            <li key={row.line} className="ly-line" data-rhymes={row.rhymes}>
              <span className="ly-letter" title={row.rhymes ? 'Rhymes with another line' : 'No rhyme yet'}>
                {row.letter}
              </span>
              <span className="ly-count">{row.syllables} syl</span>
              <span className="ly-line-text">{row.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function RhymeFinder({ language, pool }) {
  const [word, setWord] = useState('')
  const result = useMemo(() => findRhymes(word, language, pool), [word, language, pool])
  const searched = wordsIn(word).length > 0
  const empty = result.mine.length === 0 && result.more.length === 0

  return (
    <section className="card" aria-labelledby="rhyme-heading">
      <h2 id="rhyme-heading" className="section-title">
        Rhyme finder
      </h2>
      <div className="field">
        <label htmlFor="rhyme-word">Find rhymes for</label>
        <input
          id="rhyme-word"
          type="text"
          className="ly-chords"
          value={word}
          placeholder="Type a word"
          onChange={(e) => setWord(e.target.value)}
        />
      </div>

      {searched && empty && <p className="muted hint">No rhymes found for that word.</p>}

      {result.mine.length > 0 && (
        <>
          <h3 className="ly-sub">From your lyrics</h3>
          <ul className="ly-chips" aria-label="Rhymes from your lyrics">
            {result.mine.map((w) => (
              <li key={w} className="ly-chip ly-chip-mine">
                {w}
              </li>
            ))}
          </ul>
        </>
      )}

      {result.more.length > 0 && (
        <>
          <h3 className="ly-sub">More words</h3>
          <ul className="ly-chips" aria-label="More rhymes">
            {result.more.map((w) => (
              <li key={w} className="ly-chip">
                {w}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="muted hint">
        {language === 'english'
          ? 'Matches are found by spelling, so a few sound-alikes can be missed.'
          : 'For Luganda and Swahili, rhymes come from the words you have already written.'}
      </p>
    </section>
  )
}

export default function Panel() {
  const lyrics = useLyrics()
  const { song } = lyrics
  const names = useMemo(() => sectionNames(song), [song])
  const pool = useMemo(() => [...new Set(song.sections.flatMap((s) => wordsIn(s.text)))], [song.sections])

  return (
    <div className="lyrics">
      <section className="card ly-top" aria-label="Song details">
        <p className="muted ly-attached">{lyrics.attachedTo}</p>
        <div className="field ly-title-field">
          <label htmlFor="song-title">Song title</label>
          <input
            id="song-title"
            type="text"
            value={song.title}
            placeholder="Untitled song"
            onChange={(e) => lyrics.setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="song-language">Count syllables for</label>
          <select id="song-language" value={song.language} onChange={(e) => lyrics.setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ly-actions">
          <button type="button" className="btn btn-primary" onClick={lyrics.exportTxt}>
            <Icon name="download" size={18} />
            Export TXT
          </button>
        </div>
      </section>

      {song.sections.map((section, i) => (
        <SectionCard
          key={section.id}
          section={section}
          name={names[i]}
          index={i}
          count={song.sections.length}
          language={song.language}
          onEdit={lyrics.edit}
          onMove={lyrics.move}
          onRemove={lyrics.remove}
        />
      ))}

      <section aria-labelledby="add-heading">
        <h2 id="add-heading" className="section-title">
          Add a section
        </h2>
        <div className="presets">
          {SECTION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip-btn"
              aria-label={`Add ${t.name}`}
              disabled={song.sections.length >= MAX_SECTIONS}
              onClick={() => lyrics.add(t.id)}
            >
              + {t.name}
            </button>
          ))}
        </div>
      </section>

      <RhymeFinder language={song.language} pool={pool} />
    </div>
  )
}
