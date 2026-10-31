import { describe, expect, test } from 'vitest'
import { PRESETS } from '../tools/beats/presets.js'
import {
  MAX_BEAT_BARS,
  MAX_TRACKS,
  addAudioClip,
  addBeatClip,
  addTrack,
  barSeconds,
  clipEnd,
  deleteClip,
  duplicateClip,
  emptyTimeline,
  findClip,
  moveClip,
  normalizeTimeline,
  removeTrack,
  setClipGain,
  setLoop,
  setMasterVolume,
  setTempo,
  setTrack,
  snapTime,
  splitClip,
  timelineDuration,
  timelineFromSong,
  trackGain,
  trimClipEnd,
  trimClipStart,
} from './timeline.js'
import { blankSong } from '../storage/projects.js'

const pattern = PRESETS[0].pattern

function withAudio() {
  let t = emptyTimeline(120)
  t = addTrack(t, { kind: 'audio', id: 'a1' })
  t = addTrack(t, { kind: 'audio', id: 'a2' })
  t = addTrack(t, { kind: 'beat', id: 'b1' })
  t = addAudioClip(t, 'a1', { id: 'c1', takeId: 'take', name: 'Verse', start: 2, source: 10 })
  return t
}
const clip = (t, id) => findClip(t, id).clip

describe('tracks', () => {
  test('tracks are named by kind and capped', () => {
    let t = addTrack(emptyTimeline(), { kind: 'audio' })
    t = addTrack(t, { kind: 'audio' })
    t = addTrack(t, { kind: 'beat' })
    expect(t.tracks.map((x) => x.name)).toEqual(['Audio 1', 'Audio 2', 'Beat 1'])
    for (let i = 0; i < 20; i++) t = addTrack(t)
    expect(t.tracks).toHaveLength(MAX_TRACKS)
  })

  test('track settings stay inside their range', () => {
    let t = withAudio()
    t = setTrack(t, 'a1', { volume: 9, pan: -4, reverb: 3, eq: { low: 40, high: -40 } })
    const track = t.tracks[0]
    expect(track.volume).toBe(1.5)
    expect(track.pan).toBe(-1)
    expect(track.reverb).toBe(1)
    expect(track.eq).toEqual({ low: 12, mid: 0, high: -12 })
    expect(setMasterVolume(t, -1).masterVolume).toBe(0)
    expect(setTempo(t, 500).bpm).toBe(200)
  })

  test('mute silences a track and solo silences all the others', () => {
    let t = withAudio()
    t = setTrack(t, 'a1', { volume: 0.8 })
    expect(trackGain(t, t.tracks[0])).toBe(0.8)
    t = setTrack(t, 'a1', { mute: true })
    expect(trackGain(t, t.tracks[0])).toBe(0)
    t = setTrack(setTrack(t, 'a1', { mute: false }), 'a2', { solo: true })
    expect(trackGain(t, t.tracks[0])).toBe(0)
    expect(trackGain(t, t.tracks[1])).toBe(1)
    t = setTrack(t, 'a2', { mute: true })
    expect(trackGain(t, t.tracks[1])).toBe(0)
  })

  test('removing a track removes its clips', () => {
    const t = removeTrack(withAudio(), 'a1')
    expect(findClip(t, 'c1')).toBeNull()
  })
})

describe('clips', () => {
  test('only the right kind of clip goes on a track', () => {
    let t = withAudio()
    expect(addBeatClip(t, 'a1', { id: 'x', pattern })).toBe(t)
    expect(addAudioClip(t, 'b1', { id: 'x', takeId: 't', source: 3 })).toBe(t)
    t = addBeatClip(t, 'b1', { id: 'bc', start: 0, bars: 4, pattern })
    expect(clipEnd(clip(t, 'bc'), 120)).toBeCloseTo(4 * barSeconds(120))
    expect(timelineDuration(t)).toBeCloseTo(12) // the recording clip ends later than the beat
  })

  test('moving keeps the clip and may change track', () => {
    let t = withAudio()
    t = moveClip(t, 'c1', { start: 5 })
    expect(clip(t, 'c1').start).toBe(5)
    t = moveClip(t, 'c1', { start: -3, trackId: 'a2' })
    expect(findClip(t, 'c1').track.id).toBe('a2')
    expect(clip(t, 'c1').start).toBe(0)
    expect(moveClip(t, 'c1', { trackId: 'b1' })).toBe(t)
  })

  test('trimming the start moves the source point with it and never goes past the recording', () => {
    let t = trimClipStart(withAudio(), 'c1', 4)
    expect(clip(t, 'c1')).toMatchObject({ start: 4, offset: 2, length: 8 })
    expect(clipEnd(clip(t, 'c1'), 120)).toBe(12)
    t = trimClipStart(t, 'c1', 0) // cannot reveal more than was cut
    expect(clip(t, 'c1')).toMatchObject({ start: 2, offset: 0, length: 10 })
    t = trimClipStart(t, 'c1', 99)
    expect(clip(t, 'c1').length).toBeGreaterThan(0)
  })

  test('trimming the end cannot stretch a recording or empty a clip', () => {
    let t = trimClipEnd(withAudio(), 'c1', 6)
    expect(clip(t, 'c1').length).toBe(4)
    t = trimClipEnd(t, 'c1', 99)
    expect(clip(t, 'c1').length).toBe(10)
    t = trimClipEnd(t, 'c1', 0)
    expect(clip(t, 'c1').length).toBeGreaterThan(0)
  })

  test('splitting makes two clips that together play exactly the same audio', () => {
    const t = splitClip(withAudio(), 'c1', 5, 'c2')
    expect(clip(t, 'c1')).toMatchObject({ start: 2, offset: 0, length: 3 })
    expect(clip(t, 'c2')).toMatchObject({ start: 5, offset: 3, length: 7, takeId: 'take' })
    expect(splitClip(withAudio(), 'c1', 2.01, 'x').tracks[0].clips).toHaveLength(1)
    expect(splitClip(withAudio(), 'c1', 50, 'x').tracks[0].clips).toHaveLength(1)
  })

  test('beat clips trim, split and move in whole bars', () => {
    const bar = barSeconds(120)
    let t = addBeatClip(withAudio(), 'b1', { id: 'bc', start: bar, bars: 6, pattern })
    t = trimClipEnd(t, 'bc', bar + 3.2 * bar)
    expect(clip(t, 'bc').bars).toBe(3)
    t = trimClipStart(t, 'bc', bar + 1.1 * bar)
    expect(clip(t, 'bc')).toMatchObject({ bars: 2 })
    expect(clip(t, 'bc').start).toBeCloseTo(2 * bar)
    t = addBeatClip(t, 'b1', { id: 'big', start: 0, bars: 8, pattern })
    t = splitClip(t, 'big', 3.2 * bar, 'big2')
    expect(clip(t, 'big').bars).toBe(3)
    expect(clip(t, 'big2')).toMatchObject({ bars: 5 })
    expect(clip(t, 'big2').start).toBeCloseTo(3 * bar)
    expect(splitClip(t, 'big', 0.2 * bar, 'z')).toBe(t)
    expect(clip(trimClipEnd(t, 'big', 999), 'big').bars).toBeLessThanOrEqual(MAX_BEAT_BARS)
  })

  test('duplicate places a copy straight after, delete removes it, gain is limited', () => {
    let t = duplicateClip(withAudio(), 'c1', 'c2')
    expect(clip(t, 'c2').start).toBe(12)
    expect(clip(t, 'c2').takeId).toBe('take')
    t = setClipGain(t, 'c2', 9)
    expect(clip(t, 'c2').gain).toBe(2)
    t = deleteClip(t, 'c1')
    expect(findClip(t, 'c1')).toBeNull()
    expect(findClip(t, 'c2')).not.toBeNull()
  })

  test('editing never changes the timeline it was given', () => {
    const t = withAudio()
    const before = JSON.stringify(t)
    moveClip(t, 'c1', { start: 9 })
    splitClip(t, 'c1', 5, 'c2')
    trimClipStart(t, 'c1', 4)
    deleteClip(t, 'c1')
    setTrack(t, 'a1', { volume: 0 })
    expect(JSON.stringify(t)).toBe(before)
  })
})

describe('grid and loop', () => {
  test('snapping rounds to the nearest beat or bar', () => {
    expect(snapTime(1.2, 120, 'beat')).toBe(1)
    expect(snapTime(1.3, 120, 'beat')).toBe(1.5)
    expect(snapTime(3.1, 120, 'bar')).toBe(4)
    expect(snapTime(1.234, 120, 'off')).toBe(1.234)
    expect(snapTime(-5, 120, 'beat')).toBe(0)
  })

  test('the loop always has a start before its end', () => {
    const t = setLoop(emptyTimeline(), { on: true, start: 6, end: 2 })
    expect(t.loop.on).toBe(true)
    expect(t.loop.end).toBeGreaterThan(t.loop.start)
  })
})

describe('repairing saved timelines', () => {
  test('rubbish becomes an empty timeline', () => {
    expect(normalizeTimeline(null)).toEqual(emptyTimeline())
    expect(normalizeTimeline('x').tracks).toEqual([])
  })

  test('a good timeline survives unchanged', () => {
    let t = withAudio()
    t = addBeatClip(t, 'b1', { id: 'bc', start: 1, bars: 4, pattern })
    t = setLoop(setTrack(t, 'a1', { pan: 0.3, eq: { mid: 4 }, reverb: 0.2 }), { on: true, start: 1, end: 5 })
    expect(normalizeTimeline(t)).toEqual(t)
  })

  test('bad values are repaired and bad clips dropped', () => {
    const fixed = normalizeTimeline({
      bpm: 9999,
      tracks: [
        { id: 'a', kind: 'audio', volume: 50, clips: [{ id: 'ok', takeId: 't', source: 4, length: 99 }, { id: 'bad' }, null] },
        { id: 'a', kind: 'audio' },
        { kind: 'audio' },
      ],
    })
    expect(fixed.bpm).toBe(200)
    expect(fixed.tracks).toHaveLength(1)
    expect(fixed.tracks[0].volume).toBe(1.5)
    expect(fixed.tracks[0].clips).toHaveLength(1)
    expect(fixed.tracks[0].clips[0].length).toBe(4)
  })
})

describe('starting from a Studio song', () => {
  test('a voice and a beat become two tracks lined up the same way', () => {
    const song = { ...blankSong(pattern), takeId: 'voice', takeName: 'Take 1', offset: 1.5, voiceVolume: 0.9, beatVolume: 0.4 }
    const t = timelineFromSong(song, { voiceSeconds: 20 })
    expect(t.bpm).toBe(pattern.bpm)
    const beat = t.tracks.find((x) => x.kind === 'beat')
    const voice = t.tracks.find((x) => x.kind === 'audio')
    expect(beat.clips[0].start).toBe(1.5) // a positive offset: the beat comes in after the voice
    expect(voice.clips[0]).toMatchObject({ start: 0, takeId: 'voice', source: 20 })
    expect(clipEnd(beat.clips[0], t.bpm)).toBeGreaterThanOrEqual(20)
    expect(beat.volume).toBe(0.4)
    expect(voice.volume).toBe(0.9)
  })

  test('a song with no voice gives just the beat', () => {
    const t = timelineFromSong(blankSong(pattern))
    expect(t.tracks).toHaveLength(1)
    expect(t.tracks[0].clips[0].bars).toBe(pattern.order.length)
  })

  test('a negative offset starts the beat first and the voice later', () => {
    const t = timelineFromSong({ ...blankSong(pattern), takeId: 'v', offset: -1 }, { voiceSeconds: 8 })
    expect(t.tracks.find((x) => x.kind === 'audio').clips[0].start).toBe(1)
    expect(t.tracks.find((x) => x.kind === 'beat').clips[0].start).toBe(0)
  })
})
