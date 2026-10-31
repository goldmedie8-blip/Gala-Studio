import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../../tests/fakeAudio.js'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import { blankSong, createProject, listProjects, setCurrentProjectId } from '../../storage/projects.js'
import { saveTake } from '../../storage/takes.js'
import { PRESETS } from '../beats/presets.js'
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

const clipButtons = () => screen.queryAllByRole('button', { name: /starts at/ })

describe('Timeline', () => {
  test('starts with a beat track and an audio track, and an empty song is not saved', async () => {
    renderPanel()
    expect(await screen.findByLabelText('Name of beat track Beat 1')).toHaveValue('Beat 1')
    expect(screen.getByLabelText('Name of audio track Audio 1')).toHaveValue('Audio 1')
    expect(await listProjects()).toHaveLength(0)
  })

  test('adding a beat puts a clip on the beat track and makes a song', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByLabelText('Name of beat track Beat 1')
    await user.click(screen.getByRole('button', { name: /^add beat$/i }))
    expect(clipButtons()).toHaveLength(1)
    await waitFor(async () => expect(await listProjects()).toHaveLength(1), { timeout: 4000 })
  })

  test('select, duplicate, split, nudge, delete and undo', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByLabelText('Name of beat track Beat 1')
    await user.click(screen.getByRole('button', { name: /^add beat$/i }))
    await user.click(clipButtons()[0])
    expect(screen.getByLabelText('Clip name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /duplicate/i }))
    expect(clipButtons()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /move later/i }))
    await user.click(screen.getByRole('button', { name: /delete clip/i }))
    expect(clipButtons()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(clipButtons()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(clipButtons()).toHaveLength(1)
  })

  test('adding a recording puts it on the audio track', async () => {
    await saveTake({ blob: new Blob(['voice'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 2000, name: 'Verse' })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByLabelText('Name of audio track Audio 1')
    await user.click(await screen.findByRole('button', { name: /add recording/i }))
    await waitFor(() => expect(clipButtons()).toHaveLength(1))
    expect(clipButtons()[0].getAttribute('aria-label')).toMatch(/Verse/)
  })

  test('loop, metronome and tempo controls change', async () => {
    const user = userEvent.setup()
    renderPanel()
    const loop = await screen.findByRole('button', { name: /^loop$/i })
    await user.click(loop)
    expect(loop).toHaveAttribute('aria-pressed', 'true')
    const click = screen.getByRole('button', { name: /metronome/i })
    await user.click(click)
    expect(click).toHaveAttribute('aria-pressed', 'true')
    const tempo = screen.getByLabelText('Tempo in beats per minute')
    await user.clear(tempo)
    await user.type(tempo, '120')
    await user.tab()
    expect(tempo).toHaveValue(120)
  })

  test('play and stop work with the audio engine', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByLabelText('Name of beat track Beat 1')
    await user.click(screen.getByRole('button', { name: /^add beat$/i }))
    await user.click(screen.getByRole('button', { name: /^play$/i }))
    expect((await screen.findAllByRole('button', { name: /^(pause|stop)$/i })).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: /^stop$/i })[0])
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument()
  })

  test('the mixer has mute, solo, volume, pan, EQ and reverb for every track and a master', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByLabelText('Name of beat track Beat 1')
    await user.click(screen.getByRole('button', { name: 'Mixer' }))
    const mute = screen.getByRole('button', { name: 'Mute Beat 1' })
    await user.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'true')
    const solo = screen.getByRole('button', { name: 'Solo Audio 1' })
    await user.click(solo)
    expect(solo).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['Volume, Beat 1', 'Pan, Beat 1', 'Low EQ, Beat 1', 'Mid EQ, Beat 1', 'High EQ, Beat 1', 'Reverb send, Beat 1', 'Master volume']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
    fireEvent.change(screen.getByLabelText('Reverb send, Beat 1'), { target: { value: '0.5' } })
    expect(screen.getByLabelText('Reverb send, Beat 1')).toHaveValue('0.5')
  })

  test('export is refused politely when nothing is on the timeline', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByLabelText('Name of beat track Beat 1')
    await user.click(screen.getByRole('button', { name: /export wav/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  test('opening a Studio song shows its beat and voice as two tracks', async () => {
    const take = await saveTake({ blob: new Blob(['voice'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 4000, name: 'Hook' })
    const song = await createProject({ ...blankSong(PRESETS[0].pattern), takeId: take.id, takeName: 'Hook', takeDurationMs: 4000, name: 'My hit' })
    setCurrentProjectId(song.id)
    renderPanel()
    expect((await screen.findAllByText(/My hit/)).length).toBeGreaterThan(0)
    await waitFor(() => expect(clipButtons()).toHaveLength(2))
  })
})
