import { beforeEach, describe, expect, test } from 'vitest'
import { adoptDraft, copyLyrics, deleteLyrics, exportLyrics, importLyrics, loadLyrics, saveLyrics } from './lyricsStore.js'

const written = (text) => {
  const song = loadLyrics(null)
  song.sections[0].text = text
  return song
}

beforeEach(() => localStorage.clear())

describe('lyrics storage', () => {
  test('a song with nothing saved gets blank lyrics', () => {
    const song = loadLyrics('p1')
    expect(song.sections.every((s) => s.text === '')).toBe(true)
  })

  test('each song keeps its own lyrics, and the draft is separate', () => {
    saveLyrics('p1', written('one'))
    saveLyrics('p2', written('two'))
    saveLyrics(null, written('draft'))
    expect(loadLyrics('p1').sections[0].text).toBe('one')
    expect(loadLyrics('p2').sections[0].text).toBe('two')
    expect(loadLyrics(null).sections[0].text).toBe('draft')
  })

  test('the draft uses the key the Lyrics tool always used', () => {
    saveLyrics(null, written('old'))
    expect(JSON.parse(localStorage.getItem('gala.lyrics.v1')).sections[0].text).toBe('old')
  })

  test('damaged saves give blank lyrics instead of an error', () => {
    localStorage.setItem('gala.lyrics.v1.p1', '{not json')
    expect(loadLyrics('p1').sections.length).toBeGreaterThan(0)
  })

  test('deleting a song deletes its lyrics only', () => {
    saveLyrics('p1', written('one'))
    saveLyrics('p2', written('two'))
    deleteLyrics('p1')
    expect(loadLyrics('p1').sections[0].text).toBe('')
    expect(loadLyrics('p2').sections[0].text).toBe('two')
    deleteLyrics(null) // never touches the draft
    saveLyrics(null, written('draft'))
    deleteLyrics(null)
    expect(loadLyrics(null).sections[0].text).toBe('draft')
  })

  test('a copy of a song starts with the same lyrics', () => {
    saveLyrics('p1', written('one'))
    copyLyrics('p1', 'p1copy')
    expect(loadLyrics('p1copy').sections[0].text).toBe('one')
    copyLyrics('nothing', 'x')
    expect(localStorage.getItem('gala.lyrics.v1.x')).toBe(null)
  })

  test('saving a session as a song moves the draft into it', () => {
    saveLyrics(null, written('draft'))
    expect(adoptDraft('p1')).toBe(true)
    expect(loadLyrics('p1').sections[0].text).toBe('draft')
    expect(localStorage.getItem('gala.lyrics.v1')).toBe(null)
  })

  test('a song that already has lyrics is never overwritten by the draft', () => {
    saveLyrics('p1', written('mine'))
    saveLyrics(null, written('draft'))
    expect(adoptDraft('p1')).toBe(false)
    expect(loadLyrics('p1').sections[0].text).toBe('mine')
    expect(loadLyrics(null).sections[0].text).toBe('draft')
  })

  test('an empty draft is not moved', () => {
    saveLyrics(null, loadLyrics(null))
    expect(adoptDraft('p1')).toBe(false)
  })

  test('a backup carries the lyrics of songs that have words, and not blank ones or the draft', () => {
    saveLyrics('p1', written('one'))
    saveLyrics('p2', loadLyrics('p2')) // saved but empty
    saveLyrics(null, written('draft'))
    const rows = exportLyrics(['p1', 'p2', 'p3'])
    expect(rows.map((r) => r.projectId)).toEqual(['p1'])
    expect(rows[0].song.sections[0].text).toBe('one')
  })

  test('restoring a backup puts the lyrics back, overwriting the same song', () => {
    saveLyrics('p1', written('one'))
    const rows = JSON.parse(JSON.stringify(exportLyrics(['p1'])))
    saveLyrics('p1', written('changed since'))
    localStorage.removeItem('gala.lyrics.v1.p2')
    expect(importLyrics(rows)).toBe(1)
    expect(loadLyrics('p1').sections[0].text).toBe('one')
  })

  test('damaged rows in a backup are skipped without an error', () => {
    expect(importLyrics(undefined)).toBe(0)
    expect(importLyrics('nope')).toBe(0)
    expect(importLyrics([null, {}, { projectId: 7 }, { projectId: 'p1' }, { projectId: 'p1', song: { sections: [] } }])).toBe(0)
    expect(localStorage.getItem('gala.lyrics.v1.p1')).toBe(null)
  })
})
