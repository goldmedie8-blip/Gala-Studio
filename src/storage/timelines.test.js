import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, test } from 'vitest'
import { PRESETS } from '../tools/beats/presets.js'
import { addAudioClip, addBeatClip, addTrack, emptyTimeline } from '../engine/timeline.js'
import { buildBackup, restoreBackup } from './backup.js'
import { blankSong, createProject, deleteProject } from './projects.js'
import { deleteTimeline, getTimeline, listTimelines, saveTimeline } from './timelines.js'
import { getTake, saveTake } from './takes.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
})

function sample() {
  let t = addTrack(emptyTimeline(110), { kind: 'audio', id: 'a' })
  t = addTrack(t, { kind: 'beat', id: 'b' })
  t = addAudioClip(t, 'a', { id: 'c', takeId: 'take-1', start: 2, source: 5 })
  return addBeatClip(t, 'b', { id: 'bc', start: 0, bars: 4, pattern: PRESETS[0].pattern })
}

describe('timeline storage', () => {
  test('saves and reads back a timeline for a song', async () => {
    await saveTimeline('song-1', sample())
    expect(await getTimeline('song-1')).toEqual(sample())
    expect(await getTimeline('nope')).toBeUndefined()
  })

  test('a damaged save is repaired when read', async () => {
    await saveTimeline('song-1', { bpm: 9999, tracks: [{ id: 'x', kind: 'audio', volume: 40 }, 'junk'] })
    const t = await getTimeline('song-1')
    expect(t.bpm).toBe(200)
    expect(t.tracks).toHaveLength(1)
    expect(t.tracks[0].volume).toBe(1.5)
  })

  test('lists and deletes', async () => {
    await saveTimeline('a', sample())
    await saveTimeline('b', sample())
    expect((await listTimelines()).map((r) => r.projectId).sort()).toEqual(['a', 'b'])
    await deleteTimeline('a')
    expect((await listTimelines()).map((r) => r.projectId)).toEqual(['b'])
  })

  test('deleting a song deletes its timeline too', async () => {
    const song = await createProject(blankSong(PRESETS[0].pattern))
    await saveTimeline(song.id, sample())
    await deleteProject(song.id)
    expect(await getTimeline(song.id)).toBeUndefined()
  })

  test('reads one recording by id', async () => {
    const saved = await saveTake({ blob: new Blob(['abc']), mimeType: 'audio/wav', durationMs: 1000, name: 'Take 1' })
    expect((await getTake(saved.id)).name).toBe('Take 1')
    expect(await getTake('missing')).toBeUndefined()
  })
})

describe('backups include timelines', () => {
  test('a restored backup brings back each song with its timeline', async () => {
    const song = await createProject(blankSong(PRESETS[0].pattern))
    await saveTimeline(song.id, sample())
    await saveTimeline('orphan-song', sample()) // belongs to no song, so it is not backed up
    const { blob } = await buildBackup()

    globalThis.indexedDB = new IDBFactory()
    await restoreBackup(blob)
    expect(await getTimeline(song.id)).toEqual(sample())
    expect(await getTimeline('orphan-song')).toBeUndefined()
  })

  test('an older backup without timelines still restores', async () => {
    const song = await createProject(blankSong(PRESETS[0].pattern))
    const { blob } = await buildBackup()
    globalThis.indexedDB = new IDBFactory()
    await expect(restoreBackup(blob)).resolves.toMatchObject({ projects: 1 })
    expect(await getTimeline(song.id)).toBeUndefined()
  })
})
