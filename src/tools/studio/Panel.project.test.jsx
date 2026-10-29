import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../../tests/fakeAudio.js'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import { loadBeat } from '../../storage/beatStore.js'
import {
  blankSong,
  createProject,
  getCurrentProjectId,
  getProject,
  listProjects,
  setCurrentProjectId,
} from '../../storage/projects.js'
import { saveTake } from '../../storage/takes.js'
import { PRESETS } from '../beats/presets.js'
import Panel from './Panel.jsx'

const renderPanel = () =>
  render(
    <MemoryRouter>
      <Panel />
    </MemoryRouter>,
  )

const addVoice = (name) =>
  saveTake({ blob: new Blob(['voice'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 2000, name })

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
  vi.useRealTimers()
})

describe('Studio songs', () => {
  test('a new session starts unsaved, and Save song makes a song in Library', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(await screen.findByText('Not saved yet')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Kampala nights')
    await user.click(screen.getByRole('button', { name: /save song/i }))

    expect(await screen.findByText('Saved on this device')).toBeInTheDocument()
    const songs = await listProjects()
    expect(songs).toHaveLength(1)
    expect(songs[0].name).toBe('Kampala nights')
    expect(getCurrentProjectId()).toBe(songs[0].id)
    expect(screen.getByRole('button', { name: /new song/i })).toBeInTheDocument()
  })

  test('opens the current song with its name, tempo and volumes', async () => {
    const beat = { ...PRESETS[0].pattern, bpm: 97 }
    const song = await createProject({ ...blankSong(beat), name: 'Afro mix', beatVolume: 0.3, offset: 120 })
    setCurrentProjectId(song.id)

    renderPanel()

    expect(await screen.findByLabelText('Name')).toHaveValue('Afro mix')
    expect(screen.getByText('Saved on this device')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /tempo/i })).toHaveValue(97)
  })

  test('a song whose id no longer exists falls back to an unsaved session', async () => {
    setCurrentProjectId('gone')
    renderPanel()
    expect(await screen.findByText('Not saved yet')).toBeInTheDocument()
    expect(getCurrentProjectId()).toBeNull()
  })

  test('changes to a saved song are saved automatically', async () => {
    const song = await createProject({ ...blankSong(PRESETS[0].pattern), name: 'Auto' })
    setCurrentProjectId(song.id)
    renderPanel()
    await screen.findByLabelText('Name')

    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Auto renamed')

    await waitFor(async () => expect((await getProject(song.id)).name).toBe('Auto renamed'), { timeout: 3000 })
    expect(await screen.findByText('Saved on this device')).toBeInTheDocument()
  })

  test('a pending change is saved when you leave Studio', async () => {
    const song = await createProject({ ...blankSong(PRESETS[0].pattern), name: 'Leave' })
    setCurrentProjectId(song.id)
    const { unmount } = renderPanel()
    await screen.findByLabelText('Name')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Name'), ' now')
    unmount()

    await waitFor(async () => expect((await getProject(song.id)).name).toBe('Leave now'), { timeout: 3000 })
  })

  test('opening a song does not change its tempo, even with a recording that remembers another one', async () => {
    const take = await addVoice('Verse')
    const beat = { ...PRESETS[0].pattern, bpm: 88 }
    const song = await createProject({ ...blankSong(beat), name: 'Keep tempo', takeId: take.id, takeName: 'Verse' })
    setCurrentProjectId(song.id)

    renderPanel()
    await screen.findByLabelText('Name')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled())

    expect(loadBeat().bpm).toBe(88)
    expect((await getProject(song.id)).beat.bpm).toBe(88)
  })

  test('New song saves a blank song and switches to it', async () => {
    const song = await createProject({ ...blankSong(PRESETS[0].pattern), name: 'First' })
    setCurrentProjectId(song.id)
    const user = userEvent.setup()
    renderPanel()
    await screen.findByLabelText('Name')

    await user.click(screen.getByRole('button', { name: /new song/i }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Untitled song'))
    expect(getCurrentProjectId()).not.toBe(song.id)
    expect(await listProjects()).toHaveLength(2)
  })
})
