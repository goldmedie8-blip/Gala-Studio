import { describe, expect, test } from 'vitest'
import {
  MAX_SECTIONS,
  addSection,
  analyzeSection,
  countSyllables,
  defaultSong,
  exportText,
  findRhymes,
  moveSection,
  normalizeSong,
  removeSection,
  rhymeKey,
  sectionNames,
  updateSection,
} from './lyrics.js'

describe('syllables', () => {
  test('English words', () => {
    const cases = { love: 1, night: 1, baby: 2, tonight: 2, forever: 3, beautiful: 3, the: 1, people: 2 }
    for (const [word, n] of Object.entries(cases)) expect(countSyllables(word, 'english')).toBe(n)
  })

  test('Luganda and Swahili count every vowel, and a doubled vowel is one long sound', () => {
    const cases = { omukwano: 4, weebale: 3, ssebo: 2, mwana: 2, mia: 2, nze: 1 }
    for (const [word, n] of Object.entries(cases)) expect(countSyllables(word, 'bantu')).toBe(n)
  })

  test('punctuation and empty words count as nothing', () => {
    expect(countSyllables('', 'english')).toBe(0)
    expect(countSyllables('123', 'bantu')).toBe(0)
  })
})

describe('rhymes', () => {
  test('words that end alike share a key', () => {
    expect(rhymeKey('night')).toBe(rhymeKey('light'))
    expect(rhymeKey('love')).toBe(rhymeKey('above'))
    expect(rhymeKey('time')).toBe(rhymeKey('rhyme'))
    expect(rhymeKey('free')).toBe(rhymeKey('me'))
    expect(rhymeKey('night')).not.toBe(rhymeKey('day'))
  })

  test('Luganda words rhyme on their last two vowel sounds', () => {
    expect(rhymeKey('omukwano', 'bantu')).toBe(rhymeKey('kwano', 'bantu'))
    expect(rhymeKey('omukwano', 'bantu')).not.toBe(rhymeKey('mwana', 'bantu'))
  })

  test('the scheme labels lines A, B and so on, and flags the ones that rhyme', () => {
    const rows = analyzeSection('I love the night\nyou call my name\nyou are my light\nnothing is the same')
    expect(rows.map((r) => r.letter)).toEqual(['A', 'B', 'A', 'B'])
    expect(rows.every((r) => r.rhymes)).toBe(true)
    expect(rows[0].syllables).toBe(4)
  })

  test('blank lines are skipped and a lone ending is not a rhyme', () => {
    const rows = analyzeSection('one night\n\n   \nsomething else')
    expect(rows).toHaveLength(2)
    expect(rows.some((r) => r.rhymes)).toBe(false)
  })

  test('the finder uses your own words first, then the built-in list', () => {
    const result = findRhymes('night', 'english', ['light', 'day', 'night'])
    expect(result.mine).toEqual(['light'])
    expect(result.more).toContain('tonight')
    expect(result.more).not.toContain('night')
  })

  test('Luganda and Swahili only suggest words you have written', () => {
    const result = findRhymes('omukwano', 'bantu', ['kwano', 'mwana'])
    expect(result.mine).toEqual(['kwano'])
    expect(result.more).toEqual([])
  })

  test('nothing to find for an empty word', () => {
    expect(findRhymes('  ', 'english')).toEqual({ mine: [], more: [] })
  })
})

describe('song structure', () => {
  test('starts with verse, hook, verse and numbers repeated sections', () => {
    expect(sectionNames(defaultSong())).toEqual(['Verse 1', 'Hook', 'Verse 2'])
  })

  test('sections can be added, moved, edited and removed', () => {
    let song = defaultSong()
    song = addSection(song, 'bridge')
    expect(sectionNames(song)).toEqual(['Verse 1', 'Hook', 'Verse 2', 'Bridge'])
    const bridge = song.sections[3].id
    song = moveSection(song, bridge, -3)
    expect(sectionNames(song)[0]).toBe('Bridge')
    song = updateSection(song, bridge, { text: 'hello' })
    expect(song.sections[0].text).toBe('hello')
    song = removeSection(song, bridge)
    expect(song.sections).toHaveLength(3)
  })

  test('moving past the ends and removing the last section do nothing', () => {
    const song = defaultSong()
    expect(moveSection(song, song.sections[0].id, -1)).toBe(song)
    const one = { ...song, sections: [song.sections[0]] }
    expect(removeSection(one, one.sections[0].id)).toBe(one)
  })

  test('there is a limit on sections', () => {
    let song = defaultSong()
    for (let i = 0; i < MAX_SECTIONS + 5; i++) song = addSection(song, 'verse')
    expect(song.sections).toHaveLength(MAX_SECTIONS)
  })
})

describe('saving and exporting', () => {
  test('damaged saves are repaired or replaced', () => {
    expect(normalizeSong(null).sections.length).toBeGreaterThan(0)
    expect(normalizeSong({ sections: 'nope' }).sections.length).toBeGreaterThan(0)
    const fixed = normalizeSong({
      title: 5,
      language: 'klingon',
      sections: [{ id: 'a', type: 'chorus', text: 7 }, { id: 'a', type: 'hook', text: 'hi' }, null],
    })
    expect(fixed.title).toBe('')
    expect(fixed.language).toBe('english')
    expect(fixed.sections.map((s) => s.type)).toEqual(['verse', 'hook'])
    expect(new Set(fixed.sections.map((s) => s.id)).size).toBe(2)
  })

  test('text export has the title, section names, chords and lines', () => {
    const song = {
      title: 'My Song',
      language: 'english',
      sections: [
        { id: '1', type: 'verse', text: 'line one\nline two\n\n', chords: 'Am F' },
        { id: '2', type: 'hook', text: '', chords: '' },
      ],
    }
    expect(exportText(song)).toBe('My Song\n\n[Verse]\nAm F\nline one\nline two\n\n[Hook]\n')
  })
})
