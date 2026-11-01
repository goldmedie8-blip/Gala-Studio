import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Panel from './Panel.jsx'

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:lyrics')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const headings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
const sectionOrder = () => headings().filter((h) => /^(Verse|Hook|Bridge|Intro|Outro|Pre-hook)/.test(h))

describe('Lyrics panel', () => {
  test('opens with a verse, a hook and a second verse ready to write in', () => {
    render(<Panel />)
    expect(sectionOrder()).toEqual(['Verse 1', 'Hook', 'Verse 2'])
    expect(screen.getByLabelText('Verse 1 lyrics')).toBeInTheDocument()
  })

  test('shows syllables and the rhyme scheme for each line', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.type(screen.getByLabelText('Verse 1 lyrics'), 'I love the night{Enter}you are my light')
    const items = within(screen.getByRole('list', { name: 'Verse 1 line check' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('A')
    expect(items[0]).toHaveTextContent('4 syl')
    expect(items[1]).toHaveTextContent('A')
    expect(items[1]).toHaveTextContent('you are my light')
  })

  test('switching to Luganda / Swahili counts every vowel', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.type(screen.getByLabelText('Hook lyrics'), 'mia')
    const list = () => screen.getByRole('list', { name: 'Hook line check' })
    expect(list()).toHaveTextContent('1 syl')
    await user.selectOptions(screen.getByLabelText('Count syllables for'), 'bantu')
    expect(list()).toHaveTextContent('2 syl')
  })

  test('sections can be added, moved and removed', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: 'Add Bridge' }))
    expect(sectionOrder()).toEqual(['Verse 1', 'Hook', 'Verse 2', 'Bridge'])
    await user.click(screen.getByRole('button', { name: 'Move Bridge up' }))
    expect(sectionOrder()).toEqual(['Verse 1', 'Hook', 'Bridge', 'Verse 2'])
    await user.click(screen.getByRole('button', { name: 'Remove Bridge' }))
    expect(sectionOrder()).toEqual(['Verse 1', 'Hook', 'Verse 2'])
  })

  test('the first section cannot move up and the last one standing cannot be removed', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    expect(screen.getByRole('button', { name: 'Move Verse 1 up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove Verse 2' }))
    await user.click(screen.getByRole('button', { name: 'Remove Hook' }))
    expect(screen.getByRole('button', { name: 'Remove Verse' })).toBeDisabled()
  })

  test('the song is remembered on the device', async () => {
    const user = userEvent.setup()
    const first = render(<Panel />)
    await user.type(screen.getByLabelText('Song title'), 'Nsanyuka')
    await user.type(screen.getByLabelText('Hook chords'), 'Am F')
    await user.type(screen.getByLabelText('Hook lyrics'), 'weebale nnyo')
    first.unmount()

    render(<Panel />)
    expect(screen.getByLabelText('Song title')).toHaveValue('Nsanyuka')
    expect(screen.getByLabelText('Hook chords')).toHaveValue('Am F')
    expect(screen.getByLabelText('Hook lyrics')).toHaveValue('weebale nnyo')
  })

  test('a corrupted save does not break the app', () => {
    localStorage.setItem('gala.lyrics.v1', '{not json')
    render(<Panel />)
    expect(sectionOrder()).toEqual(['Verse 1', 'Hook', 'Verse 2'])
  })

  test('the rhyme finder suggests words from your lyrics and a built-in list', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.type(screen.getByLabelText('Verse 1 lyrics'), 'a bright light')
    await user.type(screen.getByLabelText('Find rhymes for'), 'night')
    expect(within(screen.getByRole('list', { name: 'Rhymes from your lyrics' })).getByText('light')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'More rhymes' })).getByText('tonight')).toBeInTheDocument()
  })

  test('says so when nothing rhymes', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.type(screen.getByLabelText('Find rhymes for'), 'strengths')
    expect(screen.getByText('No rhymes found for that word.')).toBeInTheDocument()
  })

  test('export downloads the lyrics as a text file', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Panel />)
    await user.type(screen.getByLabelText('Song title'), 'My Song')
    await user.type(screen.getByLabelText('Verse 1 lyrics'), 'first line')
    await user.click(screen.getByRole('button', { name: /export txt/i }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    const blob = URL.createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('text/plain')
    expect(await blob.text()).toContain('[Verse 1]\nfirst line')
  })

  test('with no saved song it says you are writing a draft', () => {
    render(<Panel />)
    expect(screen.getByText(/A draft, not attached to a song yet/)).toBeInTheDocument()
  })

  test('the lyrics are those of the song open in Studio, not the draft', () => {
    const sections = (text) => [{ id: 'a', type: 'verse', text, chords: '' }]
    localStorage.setItem('gala.currentProject.v1', 'p1')
    localStorage.setItem('gala.lyrics.v1.p1', JSON.stringify({ title: '', language: 'english', sections: sections('belongs to p1') }))
    localStorage.setItem('gala.lyrics.v1', JSON.stringify({ title: '', language: 'english', sections: sections('just a draft') }))
    render(<Panel />)
    expect(screen.getByLabelText('Verse lyrics')).toHaveValue('belongs to p1')
    expect(screen.getByText(/Writing the lyrics for your current song/)).toBeInTheDocument()
  })

  test('typing saves under the song, leaving the draft alone', async () => {
    const user = userEvent.setup()
    localStorage.setItem('gala.currentProject.v1', 'p1')
    render(<Panel />)
    await user.type(screen.getByLabelText('Verse 1 lyrics'), 'hello')
    expect(JSON.parse(localStorage.getItem('gala.lyrics.v1.p1')).sections[0].text).toBe('hello')
    expect(localStorage.getItem('gala.lyrics.v1')).toBe(null)
  })
})
