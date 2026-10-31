// Recorded takes live on the device in IndexedDB, so they survive closing the browser and need no internet.
// Audio is stored as raw bytes (ArrayBuffer) because that works reliably on every phone browser.
const DB_NAME = 'gala'
const STORE = 'takes'
const VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' })
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

const toTake = ({ data, ...rest }) => ({ ...rest, blob: new Blob([data], { type: rest.mimeType }) })

// `meta` is optional extra information about how the take was made, for example the tempo of the beat
// it was recorded over, so Studio can put that beat back under it.
export async function saveTake({ blob, mimeType, durationMs, name, meta }) {
  const row = {
    id: crypto.randomUUID(),
    name,
    mimeType,
    durationMs,
    createdAt: Date.now(),
    ...(meta ? { meta } : {}),
    data: await blob.arrayBuffer(),
  }
  await run('readwrite', (store) => store.put(row))
  return toTake(row)
}

// Stores a take under the id it already has. Used when restoring a backup, so songs keep pointing at it.
export async function importTake({ id, name, mimeType, durationMs, createdAt, meta, blob }) {
  const row = {
    id,
    name,
    mimeType,
    durationMs,
    createdAt,
    ...(meta ? { meta } : {}),
    data: await blob.arrayBuffer(),
  }
  await run('readwrite', (store) => store.put(row))
}

// One recording by id, or undefined if it is gone.
export async function getTake(id) {
  const row = await run('readonly', (store) => store.get(id))
  return row ? toTake(row) : undefined
}

export async function listTakes() {
  const rows = await run('readonly', (store) => store.getAll())
  return rows.sort((a, b) => b.createdAt - a.createdAt).map(toTake)
}

export function deleteTake(id) {
  return run('readwrite', (store) => store.delete(id))
}

export function nextTakeName(takes) {
  const numbers = takes
    .map((t) => /^Take (\d+)$/.exec(t.name)?.[1])
    .filter(Boolean)
    .map(Number)
  return `Take ${(numbers.length ? Math.max(...numbers) : 0) + 1}`
}

// Asks the browser not to clear our recordings when the phone is low on space.
export async function requestPersistentStorage() {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
