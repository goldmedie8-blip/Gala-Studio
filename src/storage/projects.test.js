import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, test } from 'vitest'
import { emptyPattern } from '../engine/pattern.js'
import { buildBackup, restoreBackup } from './backup.js'
import {
  blankSong,
  createProject,
  deleteProject,
  duplicateProject,
  getCurrentProjectId,
  getProject,
  listProjects,
  normalizeProject,
  renameProject,
  saveProject,
  setCurrentProjectId,
  snapshotFields,
} from './projects.js'
import { listTakes, saveTake } from './takes.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
})

const song = (over = {}) => ({ ...blankSong(emptyPattern()), name: 'Sunrise', ...over })
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms))

describe('normalizeProject', () => {
  test('repairs missing and bad fields instead of failing', () => {
    const p = normalizeProject({ id: 'a', name: '   ', beat: 'junk', offset: 99, voiceVolume: -3, beatVolume: 'x', takeId: 7 })
    expect(p.name).toBe('Untitled song')
    expect(p.beat.bpm).toBe(100)
    expect(p.offset).toBe(20)
    expect(p.voiceVolume).toBe(0)
    expect(p.beatVolume).toBe(0.6)
    expect(p.takeId).toBe('')
  })

  test('trims and shortens long names', () => {
    expect(normalizeProject({ id: 'a', name: '  hi  ' }).name).toBe('hi')
    expect(normalizeProject({ id: 'a', name: 'x'.repeat(200) }).name).toHaveLength(80)
  })

  test('no id means no song', () => {
    expect(normalizeProject(null)).toBeNull()
    expect(normalizeProject({ name: 'x' })).toBeNull()
    expect(normalizeProject('text')).toBeNull()
  })

  test('snapshotFields picks exactly what Studio edits', () => {
    expect(Object.keys(snapshotFields(normalizeProject({ id: 'a' })))).toEqual([
      'takeId',
      'takeName',
      'takeDurationMs',
      'beat',
      'offset',
      'voiceVolume',
      'beatVolume',
    ])
  })
})

describe('songs on the device', () => {
  test('creates a song and reads it back', async () => {
    const created = await createProject(song({ takeId: 't1', offset: 1.5, voiceVolume: 1.2 }))
    expect(created.id).toBeTruthy()
    const loaded = await getProject(created.id)
    expect(loaded.name).toBe('Sunrise')
    expect(loaded.takeId).toBe('t1')
    expect(loaded.offset).toBe(1.5)
    expect(loaded.voiceVolume).toBe(1.2)
  })

  test('saving updates the song and its modified time', async () => {
    const created = await createProject(song())
    await wait()
    const saved = await saveProject({ ...created, name: 'Sunset', beatVolume: 0.9 })
    expect(saved.updatedAt).toBeGreaterThan(created.updatedAt)
    expect(saved.createdAt).toBe(created.createdAt)
    expect((await getProject(created.id)).name).toBe('Sunset')
  })

  test('lists the most recently changed song first', async () => {
    const a = await createProject(song({ name: 'A' }))
    await wait()
    await createProject(song({ name: 'B' }))
    await wait()
    await saveProject({ ...a, name: 'A again' })
    expect((await listProjects()).map((p) => p.name)).toEqual(['A again', 'B'])
  })

  test('rename changes only the name', async () => {
    const created = await createProject(song({ takeId: 't1' }))
    const renamed = await renameProject(created.id, '  New name ')
    expect(renamed.name).toBe('New name')
    expect(renamed.takeId).toBe('t1')
    await expect(renameProject('missing', 'x')).rejects.toThrow(/no longer exists/)
  })

  test('duplicate makes an independent copy', async () => {
    const created = await createProject(song({ takeId: 't1', offset: 2 }))
    const copy = await duplicateProject(created.id)
    expect(copy.id).not.toBe(created.id)
    expect(copy.name).toBe('Sunrise copy')
    expect(copy.takeId).toBe('t1')
    expect(copy.offset).toBe(2)
    await saveProject({ ...copy, offset: 5 })
    expect((await getProject(created.id)).offset).toBe(2)
    expect(await listProjects()).toHaveLength(2)
  })

  test('delete removes the song and forgets it as the current one', async () => {
    const created = await createProject(song())
    setCurrentProjectId(created.id)
    await deleteProject(created.id)
    expect(await getProject(created.id)).toBeUndefined()
    expect(getCurrentProjectId()).toBeNull()
  })

  test('deleting a different song keeps the current one', async () => {
    const a = await createProject(song())
    const b = await createProject(song())
    setCurrentProjectId(a.id)
    await deleteProject(b.id)
    expect(getCurrentProjectId()).toBe(a.id)
  })

  test('saving a song without an id is refused', async () => {
    await expect(saveProject({ name: 'x' })).rejects.toThrow(/needs an id/)
  })
})

describe('current song', () => {
  test('is remembered and can be cleared', () => {
    expect(getCurrentProjectId()).toBeNull()
    setCurrentProjectId('abc')
    expect(getCurrentProjectId()).toBe('abc')
    setCurrentProjectId(null)
    expect(getCurrentProjectId()).toBeNull()
  })
})

describe('backup file', () => {
  const addTake = (name, meta) =>
    saveTake({ blob: new Blob([`audio-${name}`], { type: 'audio/wav' }), mimeType: 'audio/wav', durationMs: 1500, name, meta })

  test('restores songs and recordings on a fresh device', async () => {
    const take = await addTake('Take 1', { bpm: 102, swing: 0.1 })
    await addTake('Take 2')
    const created = await createProject(song({ takeId: take.id, takeName: 'Take 1', offset: 0.5 }))
    const { blob, projects, takes } = await buildBackup()
    expect(projects).toBe(1)
    expect(takes).toBe(2)

    globalThis.indexedDB = new IDBFactory() // a different phone, nothing saved yet
    expect(await listProjects()).toEqual([])
    const result = await restoreBackup(blob)
    expect(result).toEqual({ projects: 1, takes: 2 })

    const restored = await getProject(created.id)
    expect(restored.name).toBe('Sunrise')
    expect(restored.offset).toBe(0.5)
    expect(restored.takeId).toBe(take.id)
    const takes2 = await listTakes()
    expect(takes2.map((t) => t.name).sort()).toEqual(['Take 1', 'Take 2'])
    const back = takes2.find((t) => t.id === take.id)
    expect(await back.blob.text()).toBe('audio-Take 1') // the audio bytes survive exactly
    expect(back.meta).toEqual({ bpm: 102, swing: 0.1 })
  })

  test('restoring on the same device returns a song to its saved state', async () => {
    const created = await createProject(song())
    const { blob } = await buildBackup()
    await saveProject({ ...created, name: 'Changed my mind' })
    await restoreBackup(blob)
    expect((await getProject(created.id)).name).toBe('Sunrise')
  })

  test('an empty device makes an empty but valid backup', async () => {
    const { blob, projects, takes } = await buildBackup()
    expect([projects, takes]).toEqual([0, 0])
    expect(await restoreBackup(blob)).toEqual({ projects: 0, takes: 0 })
  })

  test('refuses files that are not Gala backups', async () => {
    await expect(restoreBackup(new Blob(['hello world, not a backup']))).rejects.toThrow(/not a Gala backup/)
    await expect(restoreBackup(new Blob([]))).rejects.toThrow(/not a Gala backup/)
  })

  test('refuses a backup that was cut short, without changing anything', async () => {
    await addTake('Take 1')
    await createProject(song())
    const { blob } = await buildBackup()
    const cut = blob.slice(0, blob.size - 5)

    globalThis.indexedDB = new IDBFactory()
    await expect(restoreBackup(cut)).rejects.toThrow(/incomplete/)
    expect(await listProjects()).toEqual([])
    expect(await listTakes()).toEqual([])
  })

  test('refuses a backup with a damaged manifest', async () => {
    const bad = new Blob(['GALABACKUP1\n', new Uint8Array([3, 0, 0, 0]), '{x}'])
    await expect(restoreBackup(bad)).rejects.toThrow(/damaged/)
  })

  test('skips damaged songs inside an otherwise good backup', async () => {
    const manifest = JSON.stringify({ version: 1, projects: [{ name: 'no id' }, { id: 'ok', name: 'Fine' }], takes: [] })
    const json = new TextEncoder().encode(manifest)
    const length = new Uint8Array(4)
    new DataView(length.buffer).setUint32(0, json.length, true)
    const result = await restoreBackup(new Blob(['GALABACKUP1\n', length, json]))
    expect(result.projects).toBe(1)
    expect((await getProject('ok')).name).toBe('Fine')
  })
})
