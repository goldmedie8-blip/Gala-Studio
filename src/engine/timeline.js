// The multitrack timeline as plain data, and every edit you can make to it. Nothing here touches audio or
// the screen, so it is easy to test and a bad save can be repaired before it reaches the app.
//
// A timeline has tracks. An audio track holds clips of recordings. A beat track holds clips of a beat
// (its sections and arrangement). Time is in seconds. Each track has its own volume, pan, mute, solo,
// three-band EQ and reverb send, which the mixer applies.
import { clampOffset, planStart } from './mix.js'
import { STEPS, normalizePattern } from './pattern.js'
import { stepSeconds } from './sequencer.js'

export const MAX_TRACKS = 12
export const MAX_CLIPS_PER_TRACK = 200
export const MAX_BEAT_BARS = 64
export const MIN_CLIP_SECONDS = 0.05
export const MAX_VOLUME = 1.5
export const EQ_RANGE = 12 // dB, each way
export const MAX_TIME = 60 * 60 // an hour

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const clamp = (value, min, max, fallback = min) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const round3 = (n) => Math.round(n * 1000) / 1000
const text = (value, fallback, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback)

export const barSeconds = (bpm) => STEPS * stepSeconds(bpm)
export const beatSeconds = (bpm) => 60 / bpm

export function emptyTimeline(bpm = 100) {
  return {
    version: 1,
    bpm: clamp(Math.round(bpm), 60, 200, 100),
    masterVolume: 1,
    metronome: false,
    loop: { on: false, start: 0, end: 8 },
    tracks: [],
  }
}

export function emptyTrack(kind, name, id = newId()) {
  return {
    id,
    name: name ?? (kind === 'beat' ? 'Beat' : 'Audio'),
    kind: kind === 'beat' ? 'beat' : 'audio',
    volume: 1,
    pan: 0,
    mute: false,
    solo: false,
    eq: { low: 0, mid: 0, high: 0 },
    reverb: 0,
    clips: [],
  }
}

// ---- repairing saved data --------------------------------------------------------------------------

function normalizeClip(raw, kind) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  const start = round3(clamp(raw.start, 0, MAX_TIME, 0))
  const name = text(raw.name, kind === 'beat' ? 'Beat' : 'Recording', 60)
  if (kind === 'beat') {
    return {
      id: raw.id,
      name,
      start,
      bars: Math.round(clamp(raw.bars, 1, MAX_BEAT_BARS, 1)),
      pattern: normalizePattern(raw.pattern),
    }
  }
  if (typeof raw.takeId !== 'string' || !raw.takeId) return null
  const source = round3(clamp(raw.source, MIN_CLIP_SECONDS, MAX_TIME, MAX_TIME))
  const offset = round3(clamp(raw.offset, 0, source - MIN_CLIP_SECONDS, 0))
  return {
    id: raw.id,
    name,
    takeId: raw.takeId,
    start,
    offset,
    length: round3(clamp(raw.length, MIN_CLIP_SECONDS, source - offset, source - offset)),
    source,
    gain: clamp(raw.gain, 0, 2, 1),
  }
}

function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  const kind = raw.kind === 'beat' ? 'beat' : 'audio'
  const seen = new Set()
  const clips = (Array.isArray(raw.clips) ? raw.clips : [])
    .map((c) => normalizeClip(c, kind))
    .filter((c) => c && !seen.has(c.id) && seen.add(c.id))
    .slice(0, MAX_CLIPS_PER_TRACK)
  return {
    id: raw.id,
    name: text(raw.name, kind === 'beat' ? 'Beat' : 'Audio', 40),
    kind,
    volume: clamp(raw.volume, 0, MAX_VOLUME, 1),
    pan: clamp(raw.pan, -1, 1, 0),
    mute: raw.mute === true,
    solo: raw.solo === true,
    eq: {
      low: clamp(raw.eq?.low, -EQ_RANGE, EQ_RANGE, 0),
      mid: clamp(raw.eq?.mid, -EQ_RANGE, EQ_RANGE, 0),
      high: clamp(raw.eq?.high, -EQ_RANGE, EQ_RANGE, 0),
    },
    reverb: clamp(raw.reverb, 0, 1, 0),
    clips,
  }
}

// Turns anything into a valid timeline, so an old or damaged save can never crash the screen.
export function normalizeTimeline(raw) {
  const base = emptyTimeline()
  if (!raw || typeof raw !== 'object') return base
  const seen = new Set()
  const tracks = (Array.isArray(raw.tracks) ? raw.tracks : [])
    .map(normalizeTrack)
    .filter((t) => t && !seen.has(t.id) && seen.add(t.id))
    .slice(0, MAX_TRACKS)
  const start = round3(clamp(raw.loop?.start, 0, MAX_TIME, 0))
  const end = round3(clamp(raw.loop?.end, 0, MAX_TIME, 8))
  return {
    version: 1,
    bpm: Math.round(clamp(raw.bpm, 60, 200, base.bpm)),
    masterVolume: clamp(raw.masterVolume, 0, MAX_VOLUME, 1),
    metronome: raw.metronome === true,
    loop: {
      on: raw.loop?.on === true,
      start: Math.min(start, end),
      end: Math.max(end, start + 0.5),
    },
    tracks,
  }
}

// ---- reading ----------------------------------------------------------------------------------------

export const clipDuration = (clip, bpm) => (clip.bars ? clip.bars * barSeconds(bpm) : clip.length)
export const clipEnd = (clip, bpm) => clip.start + clipDuration(clip, bpm)

export function timelineDuration(timeline) {
  let end = 0
  for (const track of timeline.tracks) for (const clip of track.clips) end = Math.max(end, clipEnd(clip, timeline.bpm))
  return end
}

export function findClip(timeline, clipId) {
  for (const track of timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId)
    if (clip) return { track, clip }
  }
  return null
}

// Whether a track is heard, and how loud. If any track is soloed only soloed tracks are heard.
export function trackGain(timeline, track) {
  const anySolo = timeline.tracks.some((t) => t.solo)
  const audible = !track.mute && (!anySolo || track.solo)
  return audible ? track.volume : 0
}

// Rounds a time to the nearest beat or bar. `grid` is 'off', 'beat' or 'bar'.
export function snapTime(time, bpm, grid) {
  const t = Math.max(0, time)
  const unit = grid === 'beat' ? beatSeconds(bpm) : grid === 'bar' ? barSeconds(bpm) : 0
  return unit ? round3(Math.round(t / unit) * unit) : round3(t)
}

// ---- editing: every function returns a new timeline and never changes the one it was given -----------

const mapTrack = (timeline, trackId, change) => ({
  ...timeline,
  tracks: timeline.tracks.map((t) => (t.id === trackId ? change(t) : t)),
})

const mapClip = (timeline, clipId, change) => ({
  ...timeline,
  tracks: timeline.tracks.map((t) =>
    t.clips.some((c) => c.id === clipId) ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? change(c, t) : c)) } : t,
  ),
})

export function setTempo(timeline, bpm) {
  return { ...timeline, bpm: Math.round(clamp(bpm, 60, 200, timeline.bpm)) }
}

export const setMasterVolume = (timeline, value) => ({ ...timeline, masterVolume: clamp(value, 0, MAX_VOLUME, 1) })
export const setMetronome = (timeline, on) => ({ ...timeline, metronome: Boolean(on) })

export function setLoop(timeline, patch) {
  return normalizeTimeline({ ...timeline, loop: { ...timeline.loop, ...patch } })
}

export function addTrack(timeline, { kind = 'audio', name, id = newId() } = {}) {
  if (timeline.tracks.length >= MAX_TRACKS) return timeline
  const sameKind = timeline.tracks.filter((t) => t.kind === (kind === 'beat' ? 'beat' : 'audio')).length
  const label = name ?? `${kind === 'beat' ? 'Beat' : 'Audio'} ${sameKind + 1}`
  return { ...timeline, tracks: [...timeline.tracks, emptyTrack(kind, label, id)] }
}

export const removeTrack = (timeline, trackId) => ({ ...timeline, tracks: timeline.tracks.filter((t) => t.id !== trackId) })

export const renameTrack = (timeline, trackId, name) =>
  mapTrack(timeline, trackId, (t) => ({ ...t, name: text(name, t.name, 40) }))

// Changes volume, pan, mute, solo, eq or reverb. Values are kept inside their allowed range.
export function setTrack(timeline, trackId, patch) {
  return mapTrack(timeline, trackId, (t) => {
    const next = { ...t }
    if ('volume' in patch) next.volume = clamp(patch.volume, 0, MAX_VOLUME, t.volume)
    if ('pan' in patch) next.pan = clamp(patch.pan, -1, 1, t.pan)
    if ('mute' in patch) next.mute = Boolean(patch.mute)
    if ('solo' in patch) next.solo = Boolean(patch.solo)
    if ('reverb' in patch) next.reverb = clamp(patch.reverb, 0, 1, t.reverb)
    if (patch.eq) {
      next.eq = { ...t.eq }
      for (const band of ['low', 'mid', 'high']) {
        if (band in patch.eq) next.eq[band] = clamp(patch.eq[band], -EQ_RANGE, EQ_RANGE, t.eq[band])
      }
    }
    return next
  })
}

// `source` is the full length of the recording in seconds. The clip plays `length` seconds of it.
export function addAudioClip(timeline, trackId, { takeId, name, start = 0, source, length, offset = 0, gain = 1, id = newId() }) {
  const track = timeline.tracks.find((t) => t.id === trackId)
  if (!track || track.kind !== 'audio' || track.clips.length >= MAX_CLIPS_PER_TRACK) return timeline
  const clip = normalizeClip({ id, takeId, name, start, source, offset, length: length ?? source - offset, gain }, 'audio')
  return clip ? mapTrack(timeline, trackId, (t) => ({ ...t, clips: [...t.clips, clip] })) : timeline
}

export function addBeatClip(timeline, trackId, { name, start = 0, bars = 4, pattern, id = newId() }) {
  const track = timeline.tracks.find((t) => t.id === trackId)
  if (!track || track.kind !== 'beat' || track.clips.length >= MAX_CLIPS_PER_TRACK) return timeline
  const clip = normalizeClip({ id, name, start, bars, pattern }, 'beat')
  return mapTrack(timeline, trackId, (t) => ({ ...t, clips: [...t.clips, clip] }))
}

// Moves a clip to a new start time, and optionally onto another track of the same kind.
export function moveClip(timeline, clipId, { start, trackId } = {}) {
  const found = findClip(timeline, clipId)
  if (!found) return timeline
  const to = trackId && trackId !== found.track.id ? timeline.tracks.find((t) => t.id === trackId) : found.track
  if (!to || to.kind !== found.track.kind) return timeline
  const moved = { ...found.clip, start: round3(clamp(start ?? found.clip.start, 0, MAX_TIME, found.clip.start)) }
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => {
      if (t.id === found.track.id && t.id === to.id) return { ...t, clips: t.clips.map((c) => (c.id === clipId ? moved : c)) }
      if (t.id === found.track.id) return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
      if (t.id === to.id) return { ...t, clips: [...t.clips, moved] }
      return t
    }),
  }
}

// Cuts the front of a clip off (or puts it back) so it starts at `newStart`. The end stays where it is.
export function trimClipStart(timeline, clipId, newStart) {
  const found = findClip(timeline, clipId)
  if (!found) return timeline
  const { clip } = found
  if (clip.bars) {
    const bar = barSeconds(timeline.bpm)
    const bars = Math.round((newStart - clip.start) / bar)
    const change = Math.min(clip.bars - 1, Math.max(-Math.floor(clip.start / bar), bars))
    return mapClip(timeline, clipId, (c) => ({ ...c, start: round3(c.start + change * bar), bars: c.bars - change }))
  }
  const end = clip.start + clip.length
  const delta = clamp(newStart - clip.start, -Math.min(clip.offset, clip.start), clip.length - MIN_CLIP_SECONDS, 0)
  return mapClip(timeline, clipId, (c) => ({
    ...c,
    start: round3(c.start + delta),
    offset: round3(c.offset + delta),
    length: round3(end - (c.start + delta)),
  }))
}

// Changes where a clip ends. A recording clip cannot be stretched past the end of its recording.
export function trimClipEnd(timeline, clipId, newEnd) {
  const found = findClip(timeline, clipId)
  if (!found) return timeline
  const { clip } = found
  if (clip.bars) {
    const bars = Math.round((newEnd - clip.start) / barSeconds(timeline.bpm))
    return mapClip(timeline, clipId, (c) => ({ ...c, bars: Math.min(MAX_BEAT_BARS, Math.max(1, bars)) }))
  }
  const length = clamp(newEnd - clip.start, MIN_CLIP_SECONDS, clip.source - clip.offset, clip.length)
  return mapClip(timeline, clipId, (c) => ({ ...c, length: round3(length) }))
}

// Cuts a clip in two at a time. Recording clips split anywhere; beat clips split on a bar line.
export function splitClip(timeline, clipId, at, newId_ = newId()) {
  const found = findClip(timeline, clipId)
  if (!found) return timeline
  const { clip, track } = found
  let left
  let right
  if (clip.bars) {
    const bar = barSeconds(timeline.bpm)
    const k = Math.round((at - clip.start) / bar)
    if (k < 1 || k > clip.bars - 1) return timeline
    left = { ...clip, bars: k }
    right = { ...clip, id: newId_, start: round3(clip.start + k * bar), bars: clip.bars - k }
  } else {
    const cut = at - clip.start
    if (cut < MIN_CLIP_SECONDS || clip.length - cut < MIN_CLIP_SECONDS) return timeline
    left = { ...clip, length: round3(cut) }
    right = { ...clip, id: newId_, start: round3(at), offset: round3(clip.offset + cut), length: round3(clip.length - cut) }
  }
  return mapTrack(timeline, track.id, (t) => ({ ...t, clips: t.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])) }))
}

export function deleteClip(timeline, clipId) {
  return { ...timeline, tracks: timeline.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) })) }
}

// A copy placed straight after the original.
export function duplicateClip(timeline, clipId, newId_ = newId()) {
  const found = findClip(timeline, clipId)
  if (!found || found.track.clips.length >= MAX_CLIPS_PER_TRACK) return timeline
  const copy = { ...found.clip, id: newId_, start: round3(clipEnd(found.clip, timeline.bpm)) }
  return mapTrack(timeline, found.track.id, (t) => ({ ...t, clips: [...t.clips, copy] }))
}

export const setClipGain = (timeline, clipId, gain) =>
  mapClip(timeline, clipId, (c) => (c.bars ? c : { ...c, gain: clamp(gain, 0, 2, c.gain) }))

export const renameClip = (timeline, clipId, name) => mapClip(timeline, clipId, (c) => ({ ...c, name: text(name, c.name, 60) }))

// ---- starting from a Studio song --------------------------------------------------------------------

// A song made in Studio is a voice and a beat lined up with an offset. This lays the same song out as two
// tracks, so opening Timeline continues the work instead of starting empty.
export function timelineFromSong(song, { voiceSeconds = 0 } = {}) {
  const bpm = song.beat?.bpm ?? 100
  let timeline = emptyTimeline(bpm)
  const { voiceDelay, beatDelay } = planStart(clampOffset(song.offset))
  const bar = barSeconds(timeline.bpm)
  const songBars = song.beat?.order?.length ?? 1

  const beatTrack = newId()
  timeline = addTrack(timeline, { kind: 'beat', name: 'Beat', id: beatTrack })
  const voiceEnd = voiceDelay + voiceSeconds
  const bars = voiceSeconds > 0 ? Math.min(MAX_BEAT_BARS, Math.max(1, Math.ceil((voiceEnd - beatDelay) / bar))) : songBars
  timeline = addBeatClip(timeline, beatTrack, { name: song.name ?? 'Beat', start: beatDelay, bars, pattern: song.beat })
  timeline = setTrack(timeline, beatTrack, { volume: song.beatVolume ?? 0.6 })

  if (song.takeId && voiceSeconds > 0) {
    const voiceTrack = newId()
    timeline = addTrack(timeline, { kind: 'audio', name: 'Voice', id: voiceTrack })
    timeline = addAudioClip(timeline, voiceTrack, {
      takeId: song.takeId,
      name: song.takeName || 'Voice',
      start: voiceDelay,
      source: voiceSeconds,
    })
    timeline = setTrack(timeline, voiceTrack, { volume: song.voiceVolume ?? 1 })
  }
  return timeline
}

// ---- showing time -------------------------------------------------------------------------------------

// 83.4 seconds -> "1:23.4"
export function formatClock(seconds) {
  const t = Math.max(0, Number(seconds) || 0)
  const whole = Math.floor(t)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${Math.floor((t - whole) * 10)}`
}

// Where a time falls in the music: bar and beat, both counted from 1.
export function formatBars(seconds, bpm) {
  const t = Math.max(0, Number(seconds) || 0)
  const bar = Math.floor(t / barSeconds(bpm))
  const beat = Math.floor((t - bar * barSeconds(bpm)) / beatSeconds(bpm))
  return `Bar ${bar + 1}.${beat + 1}`
}
