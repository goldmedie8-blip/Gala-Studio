import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, test } from 'vitest'
import { deleteTake, listTakes, nextTakeName, saveTake } from './takes.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const sample = (name) => ({
  blob: new Blob(['hello audio'], { type: 'audio/webm' }),
  mimeType: 'audio/webm',
  durationMs: 2500,
  name,
})

describe('take storage', () => {
  test('saves a take and reads the same audio bytes back', async () => {
    const saved = await saveTake(sample('Take 1'))
    expect(saved.id).toBeTruthy()

    const [loaded] = await listTakes()
    expect(loaded.name).toBe('Take 1')
    expect(loaded.durationMs).toBe(2500)
    expect(loaded.blob.size).toBe('hello audio'.length)
    expect(loaded.blob.type).toBe('audio/webm')
  })

  test('lists the newest take first', async () => {
    await saveTake(sample('Take 1'))
    await new Promise((r) => setTimeout(r, 5))
    await saveTake(sample('Take 2'))
    expect((await listTakes()).map((t) => t.name)).toEqual(['Take 2', 'Take 1'])
  })

  test('deletes a take', async () => {
    const saved = await saveTake(sample('Take 1'))
    await deleteTake(saved.id)
    expect(await listTakes()).toEqual([])
  })
})

describe('nextTakeName', () => {
  test('starts at Take 1', () => {
    expect(nextTakeName([])).toBe('Take 1')
  })

  test('continues after the highest number, even after deletions', () => {
    expect(nextTakeName([{ name: 'Take 1' }, { name: 'Take 4' }])).toBe('Take 5')
  })
})
