import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../../tests/fakeAudio.js'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import { listProjects } from '../../storage/projects.js'
import { getTimeline } from '../../storage/timelines.js'
import Panel from './Panel.jsx'

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

describe('Drum pads', () => {
  test('tapping a pad flashes it, and the keyboard plays pads too', async () => {
    renderPanel()
    const pad = await screen.findByRole('button', { name: 'Pad Kick' })
    fireEvent.pointerDown(pad)
    expect(pad).toHaveAttribute('data-flash', 'true')
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.getByRole('button', { name: 'Pad Snare' })).toHaveAttribute('data-flash', 'true')
  })

  test('steps can be switched on, undone and cleared', async () => {
    const user = userEvent.setup()
    renderPanel()
    const step = await screen.findByRole('button', { name: 'Kick step 1' })
    await user.click(step)
    expect(step).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /^undo$/i }))
    expect(step).toHaveAttribute('aria-pressed', 'false')
    await user.click(step)
    await user.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(step).toHaveAttribute('aria-pressed', 'false')
  })

  test('more bars means more steps', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.selectOptions(await screen.findByLabelText('Part length'), '2')
    expect(screen.getByRole('button', { name: 'Kick step 32' })).toBeInTheDocument()
  })

  test('record counts in and stop returns to idle', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: /^record$/i }))
    expect(await screen.findByRole('button', { name: /^stop$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^stop$/i }))
    expect(screen.getByRole('button', { name: /^record$/i })).toBeInTheDocument()
  })

  test('adding to the song needs drums, then adds a drum track', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: /add to my song/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await listProjects()).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Kick step 1' }))
    await user.click(screen.getByRole('button', { name: 'Snare step 5' }))
    await user.click(screen.getByRole('button', { name: /add to my song/i }))
    expect(await screen.findByText(/as a drum track/)).toBeInTheDocument()
    const [song] = await listProjects()
    const timeline = await getTimeline(song.id)
    const drums = timeline.tracks.find((t) => t.name.startsWith('Drums'))
    expect(drums.clips[0].pattern.drums.kick[0]).toBe(true)
    expect(drums.clips[0].pattern.drums.snare[4]).toBe(true)
  })

  test('clear a drum, repeat the first bar, and swing', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.selectOptions(await screen.findByLabelText('Part length'), '2')
    await user.click(screen.getByRole('button', { name: 'Kick step 1' }))
    await user.click(screen.getByRole('button', { name: 'Snare step 5' }))
    await user.click(screen.getByRole('button', { name: /repeat bar 1/i }))
    expect(screen.getByRole('button', { name: 'Kick step 17' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Snare step 21' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Clear Kick' }))
    expect(screen.getByRole('button', { name: 'Kick step 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Kick step 17' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Snare step 5' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(screen.getByLabelText('Swing'), { target: { value: '0.5' } })
    await user.click(screen.getByRole('button', { name: /add to my song/i }))
    await screen.findByText(/as a drum track/)
    const [song] = await listProjects()
    const timeline = await getTimeline(song.id)
    expect(timeline.tracks.find((t) => t.name.startsWith('Drums')).clips[0].pattern.swing).toBe(0.5)
  })
})
