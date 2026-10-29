import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { emptyPattern } from '../engine/pattern.js'
import { buildBackup } from '../storage/backup.js'
import { BEAT_STORAGE_KEY, loadBeat } from '../storage/beatStore.js'
import {
  blankSong,
  createProject,
  getCurrentProjectId,
  getProject,
  listProjects,
} from '../storage/projects.js'
import { saveTake } from '../storage/takes.js'
import Library from './Library.jsx'

const renderLibrary = () =>
  render(
    <MemoryRouter initialEntries={['/library']}>
      <Routes>
        <Route path="/library" element={<Library />} />
        <Route path="/studio" element={<p>Studio screen</p>} />
      </Routes>
    </MemoryRouter>,
  )

const song = (over = {}) => ({ ...blankSong(emptyPattern()), name: 'Sunrise', ...over })
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:backup')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => vi.restoreAllMocks())

describe('Library', () => {
  test('invites you to start a song when there are none', async () => {
    renderLibrary()
    expect(await screen.findByRole('heading', { name: 'No songs yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new song/i })).toBeInTheDocument()
  })

  test('lists songs with tempo, voice and date, newest first', async () => {
    await createProject(song({ name: 'Older', beat: { ...emptyPattern(), bpm: 90 } }))
    await wait()
    await createProject(song({ name: 'Newer', takeName: 'Take 3', takeDurationMs: 83000, beat: { ...emptyPattern(), bpm: 120 } }))
    renderLibrary()
    const list = await screen.findByRole('list', { name: 'Your songs' })
    const names = within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['Newer', 'Older'])
    expect(within(list).getByText(/120 BPM/)).toHaveTextContent('Take 3 (1:23)')
    expect(within(list).getByText(/90 BPM/)).toHaveTextContent('No voice yet')
    expect(within(list).getAllByText(/Updated \d+ \w+ \d{4}/)).toHaveLength(2)
  })

  test('a new song is created, becomes the current song and opens in Studio', async () => {
    const user = userEvent.setup()
    renderLibrary()
    await screen.findByRole('heading', { name: 'No songs yet' })
    await user.click(screen.getByRole('button', { name: /new song/i }))
    expect(await screen.findByText('Studio screen')).toBeInTheDocument()
    const [created] = await listProjects()
    expect(created.name).toBe('Untitled song')
    expect(getCurrentProjectId()).toBe(created.id)
  })

  test('opening a song makes it current and puts its beat where Studio and Beats read it', async () => {
    const user = userEvent.setup()
    const saved = await createProject(song({ beat: { ...emptyPattern(), bpm: 133 } }))
    renderLibrary()
    await user.click(await screen.findByRole('button', { name: 'Open Sunrise' }))
    expect(await screen.findByText('Studio screen')).toBeInTheDocument()
    expect(getCurrentProjectId()).toBe(saved.id)
    expect(loadBeat().bpm).toBe(133)
    expect(JSON.parse(localStorage.getItem(BEAT_STORAGE_KEY)).bpm).toBe(133)
  })

  test('renames a song', async () => {
    const user = userEvent.setup()
    const saved = await createProject(song())
    renderLibrary()
    await user.click(await screen.findByRole('button', { name: 'Rename Sunrise' }))
    const box = screen.getByLabelText('New name for Sunrise')
    await user.clear(box)
    await user.type(box, 'Golden hour')
    await user.click(screen.getByRole('button', { name: /save name/i }))
    expect(await screen.findByRole('heading', { name: 'Golden hour' })).toBeInTheDocument()
    expect((await getProject(saved.id)).name).toBe('Golden hour')
  })

  test('cancelling a rename changes nothing', async () => {
    const user = userEvent.setup()
    await createProject(song())
    renderLibrary()
    await user.click(await screen.findByRole('button', { name: 'Rename Sunrise' }))
    await user.type(screen.getByLabelText('New name for Sunrise'), 'xxx')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Sunrise' })).toBeInTheDocument()
  })

  test('duplicates a song', async () => {
    const user = userEvent.setup()
    await createProject(song())
    renderLibrary()
    await user.click(await screen.findByRole('button', { name: 'Duplicate Sunrise' }))
    expect(await screen.findByRole('heading', { name: 'Sunrise copy' })).toBeInTheDocument()
    expect(await listProjects()).toHaveLength(2)
  })

  test('deleting asks first, and keeps the recordings', async () => {
    const user = userEvent.setup()
    const take = await saveTake({ blob: new Blob(['a']), mimeType: 'audio/wav', durationMs: 1000, name: 'Take 1' })
    const saved = await createProject(song({ takeId: take.id }))
    renderLibrary()
    await user.click(await screen.findByRole('button', { name: 'Delete Sunrise' }))
    expect(screen.getByText(/recordings are kept/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('heading', { name: 'Sunrise' })).toBeInTheDocument()
    expect(await getProject(saved.id)).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Delete Sunrise' }))
    await user.click(screen.getByRole('button', { name: /yes, delete/i }))
    expect(await screen.findByRole('heading', { name: 'No songs yet' })).toBeInTheDocument()
    expect(await getProject(saved.id)).toBeUndefined()
    const { takes } = await buildBackup()
    expect(takes).toBe(1)
  })

  test('backs everything up to a .gala file', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await saveTake({ blob: new Blob(['a']), mimeType: 'audio/wav', durationMs: 1000, name: 'Take 1' })
    await createProject(song())
    renderLibrary()
    await user.click(await screen.findByRole('button', { name: /back up everything/i }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(await screen.findByRole('status')).toHaveTextContent('Backup saved: 1 song and 1 recording.')
    const link = click.mock.contexts[0]
    expect(link.download).toMatch(/^gala-backup-\d{4}-\d{2}-\d{2}\.gala$/)
  })

  test('restores a backup on a fresh device and shows the songs', async () => {
    const user = userEvent.setup()
    await createProject(song({ name: 'Restored song' }))
    const { blob } = await buildBackup()
    globalThis.indexedDB = new IDBFactory()

    renderLibrary()
    await screen.findByRole('heading', { name: 'No songs yet' })
    await user.upload(screen.getByLabelText('Restore backup'), new File([blob], 'my.gala'), { applyAccept: false })
    expect(await screen.findByRole('heading', { name: 'Restored song' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Restored 1 song and 0 recordings.')
  })

  test('says clearly when the file is not a backup', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderLibrary()
    await screen.findByRole('heading', { name: 'No songs yet' })
    await user.upload(screen.getByLabelText('Restore backup'), new File(['not a backup'], 'notes.txt'))
    expect(await screen.findByRole('alert')).toHaveTextContent('This is not a Gala backup file.')
    expect(screen.getByRole('heading', { name: 'No songs yet' })).toBeInTheDocument()
  })

  test('does not crash when this device cannot store songs', async () => {
    delete globalThis.indexedDB
    renderLibrary()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be opened/)
    expect(screen.getByRole('button', { name: /new song/i })).toBeInTheDocument()
  })
})
