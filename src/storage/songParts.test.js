import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../tests/fakeAudio.js'
import { renderTimeline } from '../engine/player.js'
import { getCurrentProjectId, listProjects } from './projects.js'
import { addPianoPartToSong } from './songParts.js'
import { getTimeline } from './timelines.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

const part = { name: 'Riff', bars: 2, sound: 'piano', notes: [{ midi: 60, start: 0, length: 1, velocity: 0.8 }, { midi: 64, start: 4, length: 1, velocity: 0.8 }] }

describe('adding a piano part to a song', () => {
  test('makes a song with the current beat plus a piano track that repeats over it', async () => {
    const { project, timeline } = await addPianoPartToSong(part)
    expect(await listProjects()).toHaveLength(1)
    expect(getCurrentProjectId()).toBe(project.id)
    const piano = timeline.tracks.find((t) => t.kind === 'piano')
    expect(piano.clips[0].loopBars).toBe(2)
    expect(piano.clips[0].bars % 2).toBe(0)
    expect(timeline.tracks.some((t) => t.kind === 'beat')).toBe(true)
    expect((await getTimeline(project.id)).tracks.find((t) => t.kind === 'piano').clips[0].notes).toHaveLength(2)
  })

  test('a second part gets its own track in the same song', async () => {
    await addPianoPartToSong(part)
    const { timeline } = await addPianoPartToSong({ ...part, name: 'Chords' })
    expect(timeline.tracks.filter((t) => t.kind === 'piano').map((t) => t.name)).toEqual(['Piano 1', 'Piano 2'])
    expect(await listProjects()).toHaveLength(1)
  })

  test('the piano track is included when the song is exported', async () => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
    const { timeline } = await addPianoPartToSong(part)
    const blob = await renderTimeline(timeline, () => null)
    expect(blob.size).toBeGreaterThan(44)
  })
})
