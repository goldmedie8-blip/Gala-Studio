// Songs (projects) live on the device in their own IndexedDB database, so they survive closing the browser
// and need no internet. A song does not copy the audio: it points at a recording by id, and the recording
// stays in the takes storage. Everything read back is cleaned up first, so an old or damaged save can
// never crash the app.
import { clampOffset } from '../engine/mix.js'
import { normalizePattern } from '../engine/pattern.js'

const DB_NAME = 'gala-projects'
const STORE = 'projects'
const VERSION = 1
const CURRENT_KEY = 'gala.currentProject.v1'
const DEFAULT_NAME = 'Untitled song'

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

const text = (value, fallback, max) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback

const volume = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : fallback
}

// Turns anything into a valid song, or null if it has no id.
export function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now()
  return {
    id: raw.id,
    name: text(raw.name, DEFAULT_NAME, 80),
    takeId: typeof raw.takeId === 'string' ? raw.takeId : '',
    takeName: text(raw.takeName, '', 80),
    takeDurationMs: Number.isFinite(raw.takeDurationMs) ? Math.max(0, raw.takeDurationMs) : 0,
    beat: normalizePattern(raw.beat),
    offset: clampOffset(raw.offset),
    voiceVolume: volume(raw.voiceVolume, 1),
    beatVolume: volume(raw.beatVolume, 0.6),
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
  }
}

// The parts of a song that Studio edits. Studio compares these to know when to save.
export const snapshotFields = (p) => ({
  takeId: p.takeId,
  takeName: p.takeName,
  takeDurationMs: p.takeDurationMs,
  beat: p.beat,
  offset: p.offset,
  voiceVolume: p.voiceVolume,
  beatVolume: p.beatVolume,
})

// A new, empty song. The beat is passed in so storage does not depend on the Beats tool.
export const blankSong = (beat) => ({
  name: DEFAULT_NAME,
  takeId: '',
  takeName: '',
  takeDurationMs: 0,
  beat,
  offset: 0,
  voiceVolume: 1,
  beatVolume: 0.6,
})

export async function createProject(fields) {
  const now = Date.now()
  const project = normalizeProject({ ...fields, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
  await run('readwrite', (store) => store.put(project))
  return project
}

export async function saveProject(project) {
  const saved = normalizeProject({ ...project, updatedAt: Date.now() })
  if (!saved) throw new Error('A song needs an id to be saved.')
  await run('readwrite', (store) => store.put(saved))
  return saved
}

// Stores a song exactly as given (keeping its dates). Used when restoring a backup.
export async function putProject(project) {
  const clean = normalizeProject(project)
  if (!clean) return null
  await run('readwrite', (store) => store.put(clean))
  return clean
}

export async function getProject(id) {
  const raw = await run('readonly', (store) => store.get(id))
  return normalizeProject(raw) ?? undefined
}

export async function listProjects() {
  const rows = await run('readonly', (store) => store.getAll())
  return rows
    .map(normalizeProject)
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProject(id) {
  await run('readwrite', (store) => store.delete(id))
  if (getCurrentProjectId() === id) setCurrentProjectId(null)
}

export async function renameProject(id, name) {
  const project = await getProject(id)
  if (!project) throw new Error('That song no longer exists.')
  return saveProject({ ...project, name })
}

export async function duplicateProject(id) {
  const project = await getProject(id)
  if (!project) throw new Error('That song no longer exists.')
  return createProject({ ...project, name: `${project.name.slice(0, 74)} copy` })
}

// The song Studio is working on. Remembered so Studio reopens on it.
export function getCurrentProjectId() {
  try {
    return localStorage.getItem(CURRENT_KEY) || null
  } catch {
    return null
  }
}

export function setCurrentProjectId(id) {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id)
    else localStorage.removeItem(CURRENT_KEY)
  } catch {
    // not remembered, Studio just opens without a song
  }
}
