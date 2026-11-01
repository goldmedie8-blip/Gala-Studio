import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test } from 'vitest'
import StudioLyrics from './StudioLyrics.jsx'

const song = (...texts) => ({
  title: '',
  language: 'english',
  sections: texts.map((text, i) => ({ id: `s${i}`, type: i === 0 ? 'verse' : 'hook', text, chords: '' })),
})
const keep = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const ui = (props) => (
  <MemoryRouter>
    <StudioLyrics projectId="p1" bpm={120} beatTime={0} playing={false} {...props} />
  </MemoryRouter>
)
const items = () => within(screen.getByRole('list', { name: 'Lyric lines' })).getAllByRole('listitem')
const currentIndex = () => items().findIndex((li) => li.getAttribute('data-current') === 'true')

beforeEach(() => localStorage.clear())

describe('Lyrics in Studio', () => {
  test('with no lyrics it points you to the Lyrics tool', () => {
    render(ui())
    expect(screen.getByText(/No lyrics for this song yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit lyrics' })).toHaveAttribute('href', '/lyrics')
  })

  test("shows this song's lines with their section names", () => {
    keep('gala.lyrics.v1.p1', song('first line\nsecond line', 'hook line'))
    render(ui())
    expect(items().map((li) => li.textContent)).toEqual(['Versefirst line', 'second line', 'Hookhook line'])
  })

  test("another song's lyrics are not shown", () => {
    keep('gala.lyrics.v1.p2', song('someone else'))
    render(ui())
    expect(screen.queryByText('someone else')).not.toBeInTheDocument()
  })

  test('nothing lights up until the song plays', () => {
    keep('gala.lyrics.v1.p1', song('one\ntwo\nthree'))
    const view = render(ui({ beatTime: 2.5, playing: false }))
    expect(currentIndex()).toBe(-1)
    view.rerender(ui({ beatTime: 2.5, playing: true }))
    expect(currentIndex()).toBe(1) // bar 2 at 120 BPM
  })

  test('the lit line moves with the beat, and nothing is lit before the beat or after the last line', () => {
    keep('gala.lyrics.v1.p1', song('one\ntwo\nthree'))
    const view = render(ui({ beatTime: -1, playing: true }))
    expect(currentIndex()).toBe(-1)
    view.rerender(ui({ beatTime: 0.5, playing: true }))
    expect(currentIndex()).toBe(0)
    view.rerender(ui({ beatTime: 4.1, playing: true }))
    expect(currentIndex()).toBe(2)
    view.rerender(ui({ beatTime: 6.5, playing: true }))
    expect(currentIndex()).toBe(-1)
  })

  test('two lines a bar moves twice as fast', async () => {
    const user = userEvent.setup()
    keep('gala.lyrics.v1.p1', song('one\ntwo\nthree\nfour'))
    const view = render(ui({ beatTime: 1.5, playing: true }))
    expect(currentIndex()).toBe(0)
    await user.click(screen.getByRole('button', { name: '2 lines a bar' }))
    view.rerender(ui({ beatTime: 1.5, playing: true }))
    expect(currentIndex()).toBe(1)
  })

  test('saving the session as a song brings its draft lyrics along', () => {
    keep('gala.lyrics.v1', song('my draft'))
    const view = render(ui({ projectId: null }))
    expect(screen.getByText('my draft')).toBeInTheDocument()
    view.rerender(ui({ projectId: 'p9' }))
    expect(screen.getByText('my draft')).toBeInTheDocument()
    expect(localStorage.getItem('gala.lyrics.v1')).toBe(null)
    expect(JSON.parse(localStorage.getItem('gala.lyrics.v1.p9')).sections[0].text).toBe('my draft')
  })
})
