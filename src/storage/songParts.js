// Puts a played part (from the Piano tool, and later the Drums tool) onto the current song's timeline.
// If there is no current song yet, one is made, using the beat you are working on.
import { MAX_BEAT_BARS, addBeatClip, addPianoClip, addTrack, clipEnd, emptyTimeline, newId, timelineFromSong } from '../engine/timeline.js'
import { PRESETS } from '../tools/beats/presets.js'
import { loadBeat } from './beatStore.js'
import { blankSong, createProject, getCurrentProjectId, getProject, setCurrentProjectId } from './projects.js'
import { getTimeline, saveTimeline } from './timelines.js'

// The song a new part would go into: { project, isNew }.
export async function currentSong() {
  const id = getCurrentProjectId()
  const project = id ? await getProject(id) : null
  return project ?? null
}

async function songTimeline(project) {
  const saved = await getTimeline(project.id)
  if (saved) return saved
  const fromSong = timelineFromSong(project, { voiceSeconds: (project.takeDurationMs ?? 0) / 1000 })
  return fromSong.tracks.length ? fromSong : emptyTimeline(project.beat?.bpm ?? 100)
}

// Opens the current song's timeline (making the song if there is none) and works out where a new part
// goes: where the beat starts, long enough to cover the song.
async function prepare(partBars) {
  let project = await currentSong()
  if (!project) {
    project = await createProject({ ...blankSong(loadBeat() ?? PRESETS[0].pattern), name: 'Untitled song' })
    setCurrentProjectId(project.id)
  }
  const timeline = await songTimeline(project)
  const beatClips = timeline.tracks.flatMap((t) => t.clips.filter((c) => c.bars && !c.notes))
  const start = beatClips.length ? Math.min(...beatClips.map((c) => c.start)) : 0
  const songEnd = beatClips.length ? Math.max(...beatClips.map((c) => clipEnd(c, timeline.bpm))) : 0
  const coverBars = Math.ceil((songEnd - start) / ((60 / timeline.bpm) * 4))
  const bars = Math.min(MAX_BEAT_BARS, Math.max(partBars, Math.ceil(coverBars / partBars) * partBars))
  return { project, timeline, start, bars }
}

// part: { name, bars, notes, sound }. Returns { project, timeline, clipId }.
export async function addPianoPartToSong(part) {
  const { project, timeline: base, start, bars } = await prepare(part.bars)
  const trackId = newId()
  const count = base.tracks.filter((t) => t.kind === 'piano').length
  let timeline = addTrack(base, { kind: 'piano', name: `Piano ${count + 1}`, id: trackId })
  const clipId = newId()
  timeline = addPianoClip(timeline, trackId, { id: clipId, name: part.name || 'Piano part', start, bars, loopBars: part.bars, notes: part.notes, sound: part.sound })
  await saveTimeline(project.id, timeline)
  return { project, timeline, clipId }
}

// part: { name, bars, pattern } where pattern is a beat made of the drums that were played.
export async function addDrumPartToSong(part) {
  const { project, timeline: base, start, bars } = await prepare(part.bars)
  const trackId = newId()
  const count = base.tracks.filter((t) => t.kind === 'beat').length
  let timeline = addTrack(base, { kind: 'beat', name: `Drums ${count + 1}`, id: trackId })
  const clipId = newId()
  timeline = addBeatClip(timeline, trackId, { id: clipId, name: part.name || 'Drum part', start, bars, pattern: part.pattern })
  await saveTimeline(project.id, timeline)
  return { project, timeline, clipId }
}
