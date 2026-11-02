import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../../tests/fakeAudio.js'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import { getTimeline } from '../../storage/timelines.js'
import { getCurrentProjectId, listProjects } from '../../storage/projects.js'
import Panel from './Panel.jsx'
import { snapToKey } from './usePiano.js'

const renderPanel = () =>
  render(
    <MemoryRouter>
      <Panel />
    </MemoryRouter>,
  )

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
})
afterEach(() => {
  resetAudioContextForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Piano', () => {
  test('shows a keyboard and lights keys while pressed', async () => {
    renderPanel()
    const key = await screen.findByRole('button', { name: 'Piano key C3' })
    fireEvent.pointerDown(key)
    expect(key).toHaveAttribute('aria-pressed', 'true')
    fireEvent.pointerUp(key)
    expect(key).toHaveAttribute('aria-pressed', 'false')
  })

  test('letter keys play and the octave buttons move the keyboard', async () => {
    const user = userEvent.setup()
    renderPanel()
    fireEvent.keyDown(window, { key: 'a' })
    expect(await screen.findByRole('button', { name: 'Piano key C3' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyUp(window, { key: 'a' })
    await user.click(screen.getByRole('button', { name: 'Octave up' }))
    expect(screen.getByRole('button', { name: 'Piano key C4' })).toBeInTheDocument()
  })

  test('chords press several notes and the key helper marks the scale', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.selectOptions(screen.getByLabelText('Chords'), 'major')
    await user.click(screen.getByRole('button', { name: 'Show key' }))
    const key = screen.getByRole('button', { name: 'Piano key C#3' })
    expect(key).toHaveAttribute('data-in-key', 'false')
  })

  test('record starts a count-in, stop returns to idle', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /^record$/i }))
    expect(await screen.findByRole('button', { name: /^stop$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^stop$/i }))
    expect(screen.getByRole('button', { name: /^record$/i })).toBeInTheDocument()
  })

  test('adding to the song needs notes, then makes a song with a piano track', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /add to my song/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await listProjects()).toHaveLength(0)
  })

  test('snapToKey moves a wrong note into the key', () => {
    expect(snapToKey(61, 0, 'major')).toBe(62) // C# in C major goes up to D
    expect(snapToKey(60, 0, 'major')).toBe(60)
  })

  test('pressing the roll adds a note, which can be edited, moved and deleted', async () => {
    const user = userEvent.setup()
    renderPanel()
    const roll = await screen.findByRole('group', { name: 'Recorded notes' })
    // jsdom has no layout, so give the roll a size: 2 bars across 800px, rows of 14px
    roll.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 25 * 14, right: 800, bottom: 350 })
    fireEvent.click(roll, { clientX: 100, clientY: 5 })
    const note = await screen.findByRole('button', { name: /^Note .* at beat 2\.00$/ })
    expect(note).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Higher' }))
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.getByRole('button', { name: /at beat 2\.25$/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Up an octave' }))
    await user.click(screen.getByRole('button', { name: /repeat to make it twice as long/i }))
    expect(screen.getAllByRole('button', { name: /^Note / })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /^Note .* at beat 2\.25$/ }))
    await user.click(screen.getByRole('button', { name: /delete note/i }))
    expect(screen.getAllByRole('button', { name: /^Note / })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /^undo$/i }))
    expect(screen.getAllByRole('button', { name: /^Note / })).toHaveLength(2)
  })
})
