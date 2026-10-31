// A song's multitrack timeline lives on the device in its own IndexedDB database, one timeline per song,
// stored under the song's id. Everything read back is repaired first, so a damaged save cannot crash the app.
import { normalizeTimeline } from '../engine/timeline.js'

const DB_NAME = 'gala-timelines'
const STORE = 'timelines'
const VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'projectId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run(mode, action) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

const toRow = (projectId, timeline) => ({ projectId, updatedAt: Date.now(), timeline: normalizeTimeline(timeline) })
const fromRow = (row) => (row && typeof row.projectId === 'string' ? { projectId: row.projectId, updatedAt: row.updatedAt ?? 0, timeline: normalizeTimeline(row.timeline) } : null)

export async function saveTimeline(projectId, timeline) {
  await run('readwrite', (store) => store.put(toRow(projectId, timeline)))
}

export async function getTimeline(projectId) {
  return fromRow(await run('readonly', (store) => store.get(projectId)))?.timeline
}

export async function listTimelines() {
  const rows = await run('readonly', (store) => store.getAll())
  return rows.map(fromRow).filter(Boolean)
}

export function deleteTimeline(projectId) {
  return run('readwrite', (store) => store.delete(projectId))
}
