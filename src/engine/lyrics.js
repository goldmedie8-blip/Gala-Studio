// Pure helpers for the Lyrics tool. No React, no browser APIs, so everything here is easy to test.
//
// A song is { title, language, sections: [{ id, type, text, chords }] }.
// Syllable counts and rhymes are worked out from spelling, so they are a writing aid, not a dictionary:
// they are right most of the time and can miss the odd word. Two counting styles are offered because
// English and the Bantu languages (Luganda, Swahili) are pronounced differently.

export const SECTION_TYPES = [
  { id: 'intro', name: 'Intro' },
  { id: 'verse', name: 'Verse' },
  { id: 'pre', name: 'Pre-hook' },
  { id: 'hook', name: 'Hook' },
  { id: 'bridge', name: 'Bridge' },
  { id: 'outro', name: 'Outro' },
]

export const LANGUAGES = [
  { id: 'english', name: 'English / Pidgin' },
  { id: 'bantu', name: 'Luganda / Swahili' },
]

export const MAX_SECTIONS = 20
const MAX_TEXT = 5000
const MAX_TITLE = 80
const MAX_CHORDS = 200

const TYPE_IDS = SECTION_TYPES.map((t) => t.id)
const LANGUAGE_IDS = LANGUAGES.map((l) => l.id)

const makeId = () => `s${Math.random().toString(36).slice(2, 9)}`

export function newSection(type = 'verse', text = '', chords = '') {
  return { id: makeId(), type, text, chords }
}

// A new song starts with a shape most songs use, so there is something to write into straight away.
export function defaultSong() {
  return { title: '', language: 'english', sections: [newSection('verse'), newSection('hook'), newSection('verse')] }
}

// Anything read back from storage is checked here, so a damaged save can never break the panel.
export function normalizeSong(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.sections)) return defaultSong()
  const seen = new Set()
  const sections = data.sections
    .filter((s) => s && typeof s === 'object')
    .slice(0, MAX_SECTIONS)
    .map((s) => {
      const id = typeof s.id === 'string' && s.id && !seen.has(s.id) ? s.id : makeId()
      seen.add(id)
      return {
        id,
        type: TYPE_IDS.includes(s.type) ? s.type : 'verse',
        text: typeof s.text === 'string' ? s.text.slice(0, MAX_TEXT) : '',
        chords: typeof s.chords === 'string' ? s.chords.slice(0, MAX_CHORDS) : '',
      }
    })
  if (sections.length === 0) return defaultSong()
  return {
    title: typeof data.title === 'string' ? data.title.slice(0, MAX_TITLE) : '',
    language: LANGUAGE_IDS.includes(data.language) ? data.language : 'english',
    sections,
  }
}

// "Verse 1", "Verse 2", "Hook": a number only appears when a type is used more than once.
export function sectionNames(song) {
  const total = {}
  for (const s of song.sections) total[s.type] = (total[s.type] ?? 0) + 1
  const seen = {}
  return song.sections.map((s) => {
    const base = SECTION_TYPES.find((t) => t.id === s.type)?.name ?? 'Verse'
    if (total[s.type] === 1) return base
    seen[s.type] = (seen[s.type] ?? 0) + 1
    return `${base} ${seen[s.type]}`
  })
}

export const addSection = (song, type) =>
  song.sections.length >= MAX_SECTIONS ? song : { ...song, sections: [...song.sections, newSection(type)] }

export const removeSection = (song, id) =>
  song.sections.length <= 1 ? song : { ...song, sections: song.sections.filter((s) => s.id !== id) }

export function moveSection(song, id, delta) {
  const from = song.sections.findIndex((s) => s.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= song.sections.length) return song
  const sections = [...song.sections]
  const [moved] = sections.splice(from, 1)
  sections.splice(to, 0, moved)
  return { ...song, sections }
}

export const updateSection = (song, id, patch) => ({
  ...song,
  sections: song.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
})

// ---- words, syllables and rhymes ----

export const wordsIn = (text) =>
  (text.toLowerCase().match(/[\p{L}'\u2019]+/gu) ?? []).map((w) => w.replace(/['\u2019]/g, '')).filter(Boolean)

const letters = (word) => word.toLowerCase().replace(/[^a-z]/g, '')

// A few words the simple rule gets wrong that show up in songs all the time.
const ENGLISH_OVERRIDES = { beautiful: 3, being: 2, fire: 2, hour: 1, our: 1, every: 2, different: 2, family: 3 }

function englishSyllables(word) {
  const w = letters(word)
  if (!w) return 0
  if (ENGLISH_OVERRIDES[w]) return ENGLISH_OVERRIDES[w]
  if (w.length <= 3) return 1
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const groups = trimmed.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 1)
}

// Luganda and Swahili are written the way they sound: every vowel is a beat, and a doubled vowel
// (as in "weebale") is one long sound.
function bantuSyllables(word) {
  const w = letters(word)
  if (!w) return 0
  const groups = w.match(/([aeiou])\1*/g)
  return Math.max(1, groups ? groups.length : 1)
}

export function countSyllables(word, language = 'english') {
  return language === 'bantu' ? bantuSyllables(word) : englishSyllables(word)
}

export const lineSyllables = (line, language = 'english') =>
  wordsIn(line).reduce((sum, w) => sum + countSyllables(w, language), 0)

// The ending a word is matched on: words with the same key rhyme.
export function rhymeKey(word, language = 'english') {
  const w = letters(word)
  if (!w) return ''
  const groups = [...w.matchAll(/[aeiouy]+/g)]
  if (groups.length === 0) return w
  if (language === 'bantu') {
    // Words end in vowels, so the rhyme is the last two vowel sounds with what sits between them.
    const from = groups.length >= 2 ? groups[groups.length - 2] : groups[0]
    return w.slice(from.index).replace(/([aeiou])\1+/g, '$1')
  }
  let last = groups[groups.length - 1]
  // A silent final e ("love", "time") belongs to the vowel before it.
  if (groups.length > 1 && last[0] === 'e' && last.index === w.length - 1) last = groups[groups.length - 2]
  return w.slice(last.index).replace(/y/g, 'i').replace(/ee$/, 'e')
}

const schemeLetter = (n) => (n < 26 ? String.fromCharCode(65 + n) : '?')

// One entry per written line: its syllables, the rhyme letter (A, B, ...) and whether it rhymes with another.
export function analyzeSection(text, language = 'english') {
  const rows = []
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    const words = wordsIn(line)
    if (words.length === 0) return
    rows.push({
      line: index,
      text: line,
      syllables: lineSyllables(line, language),
      key: rhymeKey(words[words.length - 1], language),
    })
  })
  const letterOf = new Map()
  const counts = new Map()
  for (const row of rows) {
    if (!letterOf.has(row.key)) letterOf.set(row.key, schemeLetter(letterOf.size))
    counts.set(row.key, (counts.get(row.key) ?? 0) + 1)
  }
  return rows.map((row) => ({ ...row, letter: letterOf.get(row.key), rhymes: counts.get(row.key) > 1 }))
}

// Common song words to suggest from. English only: the Bantu side suggests words from your own lyrics,
// because a made-up word list would teach the wrong spellings.
export const RHYME_WORDS = `
love above dove glove heart apart start art part smart night light tight fight right sight bright flight tonight might
fire desire higher tire wire liar dream team seem stream scream queen mean clean green seen between free me see be tree
key sea agree baby maybe crazy lady day way say stay play pray away today okay gray break make take shake wake fake
mistake time mine line fine shine sign wine divine rhyme climb grind mind find kind blind behind soul whole control gold
cold hold told bold roll goal home alone phone stone bone throne own grown known shown zone tone true you blue new
through too do knew view crew life wife knife strife pain rain train chain again gain brain lane plane name game flame
fame same shame blame came claim hand land stand sand band plan man can fan ran money honey sunny funny eyes skies
lies cries rise wise prize tries flies fall call all wall small tall ball dance chance romance glance real feel deal
heal steal wheel kneel sound ground found around round bound crown down town drown brown frown hope rope slope street
beat heat feet sweet meet seat repeat complete defeat treat heaven seven grow flow show know slow go low glow
`
  .split(/\s+/)
  .filter(Boolean)

export function findRhymes(word, language = 'english', mine = []) {
  const target = wordsIn(word).pop()
  if (!target) return { mine: [], more: [] }
  const key = rhymeKey(target, language)
  if (!key) return { mine: [], more: [] }
  const matches = (w) => w !== target && rhymeKey(w, language) === key
  const own = [...new Set(mine.filter(matches))].slice(0, 12)
  const more = language === 'english' ? RHYME_WORDS.filter((w) => matches(w) && !own.includes(w)).slice(0, 24) : []
  return { mine: own, more }
}

// Plain text for sharing: title, then each section with its chords above its lines.
export function exportText(song) {
  const names = sectionNames(song)
  const out = []
  if (song.title.trim()) out.push(song.title.trim(), '')
  song.sections.forEach((s, i) => {
    out.push(`[${names[i]}]`)
    if (s.chords.trim()) out.push(s.chords.trim())
    const body = s.text.replace(/\s+$/, '')
    if (body) out.push(...body.split('\n').map((l) => l.trimEnd()))
    out.push('')
  })
  return `${out.join('\n').trimEnd()}\n`
}
