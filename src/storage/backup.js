// A .gala backup file holds every song and every recording, so work can be moved to another phone
// or restored after clearing the browser. Layout:
//   "GALABACKUP1\n"   identifies the file
//   4 bytes           length of the manifest (little-endian)
//   manifest          JSON: the songs, and the details and size of each recording
//   audio bytes       every recording one after another, in manifest order
import { importTake, listTakes } from './takes.js'
import { listProjects, normalizeProject, putProject } from './projects.js'
import { listTimelines, saveTimeline } from './timelines.js'
import { exportLyrics, importLyrics } from './lyricsStore.js'

const MAGIC = 'GALABACKUP1\n'
const encoder = new TextEncoder()

export async function buildBackup() {
  const [projects, takes, timelines] = await Promise.all([listProjects(), listTakes(), listTimelines()])
  const manifest = {
    version: 1,
    createdAt: Date.now(),
    projects,
    timelines: timelines.filter((t) => projects.some((p) => p.id === t.projectId)),
    lyrics: exportLyrics(projects.map((p) => p.id)),
    takes: takes.map(({ id, name, mimeType, durationMs, createdAt, meta, blob }) => ({
      id,
      name,
      mimeType,
      durationMs,
      createdAt,
      ...(meta ? { meta } : {}),
      size: blob.size,
    })),
  }
  const json = encoder.encode(JSON.stringify(manifest))
  const length = new Uint8Array(4)
  new DataView(length.buffer).setUint32(0, json.length, true)
  const blob = new Blob([MAGIC, length, json, ...takes.map((t) => t.blob)], { type: 'application/octet-stream' })
  return { blob, projects: projects.length, takes: takes.length }
}

// Errors with a message written for people, safe to show on screen as they are.
export class BackupError extends Error {
  name = 'BackupError'
}

function invalid(message = 'This is not a Gala backup file.') {
  return new BackupError(message)
}

// Puts everything in a backup back on this device. Same ids are overwritten, so restoring on the
// device the backup came from brings songs back to the saved state.
export async function restoreBackup(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const head = new TextDecoder().decode(bytes.subarray(0, MAGIC.length))
  if (head !== MAGIC || bytes.length < MAGIC.length + 4) throw invalid()

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const jsonLength = view.getUint32(MAGIC.length, true)
  const jsonStart = MAGIC.length + 4
  if (jsonStart + jsonLength > bytes.length) throw invalid('This backup file is incomplete.')

  let manifest
  try {
    manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(jsonStart, jsonStart + jsonLength)))
  } catch {
    throw invalid('This backup file is damaged.')
  }
  const takes = Array.isArray(manifest?.takes) ? manifest.takes : []
  const projects = Array.isArray(manifest?.projects) ? manifest.projects : []
  const timelines = Array.isArray(manifest?.timelines) ? manifest.timelines : []
  const lyrics = Array.isArray(manifest?.lyrics) ? manifest.lyrics : []

  // Check the audio is all there before changing anything on the device.
  let offset = jsonStart + jsonLength
  const parts = []
  for (const take of takes) {
    const size = Number(take?.size)
    if (typeof take?.id !== 'string' || !Number.isInteger(size) || size < 0 || offset + size > bytes.length) {
      throw invalid('This backup file is incomplete.')
    }
    parts.push({ take, blob: new Blob([bytes.subarray(offset, offset + size)], { type: take.mimeType || 'audio/wav' }) })
    offset += size
  }

  for (const { take, blob } of parts) {
    await importTake({
      id: take.id,
      name: typeof take.name === 'string' ? take.name : 'Recording',
      mimeType: take.mimeType || 'audio/wav',
      durationMs: Number.isFinite(take.durationMs) ? take.durationMs : 0,
      createdAt: Number.isFinite(take.createdAt) ? take.createdAt : Date.now(),
      meta: take.meta,
      blob,
    })
  }
  let restored = 0
  for (const project of projects) {
    if (normalizeProject(project) && (await putProject(project))) restored += 1
  }
  // Older backups have no timelines. Newer ones bring back each song's multitrack layout too.
  for (const row of timelines) {
    if (typeof row?.projectId === 'string') await saveTimeline(row.projectId, row.timeline)
  }
  // Restore lyrics for each project
  for (const lyric of lyrics) {
    await importLyrics(lyric)
  }
  return { projects: restored, takes: parts.length }
}
