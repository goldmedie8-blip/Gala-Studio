import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext, fakeVoiceBuffer } from '../../tests/fakeAudio.js'
import { PRESETS } from '../tools/beats/presets.js'
import { createMixer } from './mixer.js'
import { TimelinePlayer, renderTimeline, scheduleAudio, scheduleBeats } from './player.js'
import { STEPS, emptyPattern, toggleDrum } from './pattern.js'
import { addAudioClip, addBeatClip, addTrack, emptyTimeline, setLoop, setTrack, timelineDuration } from './timeline.js'
import { DRUMS } from './voices.js'

const buffer = fakeVoiceBuffer(4)
const getBuffer = (id) => (id === 'take' ? buffer : undefined)

function build() {
  let t = emptyTimeline(120)
  t = addTrack(t, { kind: 'audio', id: 'a1' })
  t = addTrack(t, { kind: 'beat', id: 'b1' })
  t = addAudioClip(t, 'a1', { id: 'c1', takeId: 'take', start: 1, source: 4 })
  return t
}

function setup(timeline = build()) {
  const ctx = new FakeAudioContext()
  const mixer = createMixer(ctx)
  mixer.update(timeline)
  return { ctx, mixer, timeline }
}

describe('scheduleAudio', () => {
  test('starts a clip at its place on the clock, from the right point of the recording', () => {
    const { ctx, mixer, timeline } = setup()
    const sources = []
    vi.spyOn(ctx, 'createBufferSource').mockImplementation(() => {
      const s = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
      sources.push(s)
      return s
    })
    scheduleAudio(ctx, mixer, timeline, getBuffer, { from: 0, to: Infinity, ctxAt: 10 })
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalledWith(11, 0, 4)
  })

  test('starting part-way through a clip skips the part already passed', () => {
    const { ctx, mixer, timeline } = setup()
    const starts = []
    vi.spyOn(ctx, 'createBufferSource').mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: (...args) => starts.push(args),
      stop: vi.fn(),
    }))
    scheduleAudio(ctx, mixer, timeline, getBuffer, { from: 2.5, to: Infinity, ctxAt: 10 })
    expect(starts).toEqual([[10, 1.5, 2.5]])
  })

  test('a loop end cuts the clip, and a clip outside the range or without audio is skipped', () => {
    const { ctx, mixer, timeline } = setup()
    const starts = []
    vi.spyOn(ctx, 'createBufferSource').mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: (...args) => starts.push(args),
      stop: vi.fn(),
    }))
    scheduleAudio(ctx, mixer, timeline, getBuffer, { from: 0, to: 3, ctxAt: 0 })
    expect(starts).toEqual([[1, 0, 2]])
    starts.length = 0
    scheduleAudio(ctx, mixer, timeline, getBuffer, { from: 6, to: 9, ctxAt: 0 })
    scheduleAudio(ctx, mixer, timeline, () => undefined, { from: 0, to: 9, ctxAt: 0 })
    expect(starts).toEqual([])
  })
})

describe('scheduleBeats', () => {
  test('every step is played once, even when the range is cut into windows', () => {
    let { ctx, mixer, timeline } = setup()
    let p = toggleDrum({ ...emptyPattern(), bpm: 120 }, 'kick', 0)
    p = toggleDrum(p, 'kick', 8)
    timeline = addBeatClip(timeline, 'b1', { id: 'bc', start: 0.5, bars: 2, pattern: p })
    const kick = vi.spyOn(DRUMS, 'kick')
    const dest = ctx.createGain()
    const args = { ctxAt: 100, from: 0, destFor: () => dest }
    for (const [a, b] of [[0, 0.7], [0.7, 0.9], [0.9, 1.31], [1.31, 4], [4, 9]]) scheduleBeats(ctx, mixer, timeline, { ...args, a, b })
    // 120 BPM: a bar is 2 s. Kicks on steps 1 and 9 of two bars land at 0.5, 1.5, 2.5 and 3.5.
    expect(kick.mock.calls.map((c) => c[2]).sort((x, y) => x - y)).toEqual([100.5, 101.5, 102.5, 103.5])
    kick.mockRestore()
  })

  test('metronome clicks fall on every beat with the first of each bar accented', () => {
    const { ctx, mixer, timeline } = setup()
    const osc = vi.spyOn(ctx, 'createOscillator')
    scheduleBeats(ctx, mixer, timeline, { a: 0, b: 2, ctxAt: 0, from: 0, destFor: () => null, clicks: true })
    expect(osc).toHaveBeenCalledTimes(4) // 120 BPM: a beat every 0.5 s
  })
})

describe('TimelinePlayer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function player(timeline = build(), extra = {}) {
    const s = setup(timeline)
    const onEnd = vi.fn()
    const p = new TimelinePlayer({ ctx: s.ctx, mixer: s.mixer, getTimeline: () => s.timeline, getBuffer, onEnd, ...extra })
    return { ...s, p, onEnd }
  }
  const advance = (ctx, seconds) => {
    for (let i = 0; i < Math.round(seconds / 0.025); i++) {
      ctx.currentTime += 0.025
      vi.advanceTimersByTime(25)
    }
  }

  test('play, pause and stop move the playhead', () => {
    const { ctx, p } = player()
    expect(p.state).toBe('stopped')
    p.play(0)
    expect(p.state).toBe('playing')
    advance(ctx, 1)
    expect(p.position()).toBeCloseTo(0.94, 1) // there is a short start delay
    p.pause()
    const held = p.position()
    advance(ctx, 1)
    expect(p.position()).toBe(held)
    expect(p.state).toBe('paused')
    p.play()
    advance(ctx, 0.5)
    expect(p.position()).toBeGreaterThan(held)
    p.stop()
    expect(p.position()).toBe(0)
    expect(p.state).toBe('stopped')
  })

  test('seeking while playing jumps, and while stopped just moves the playhead', () => {
    const { ctx, p } = player()
    p.seek(3)
    expect(p.position()).toBe(3)
    expect(p.state).toBe('stopped')
    p.play()
    advance(ctx, 0.5)
    p.seek(1)
    advance(ctx, 0.2)
    expect(p.position()).toBeGreaterThanOrEqual(1)
    expect(p.position()).toBeLessThan(1.5)
    p.stop()
  })

  test('stops by itself at the end of the song', () => {
    const { ctx, p, onEnd, timeline } = player()
    p.play(0)
    advance(ctx, timelineDuration(timeline) + 1)
    expect(onEnd).toHaveBeenCalledOnce()
    expect(p.state).toBe('stopped')
    expect(vi.getTimerCount()).toBe(0)
  })

  test('a loop plays on without a gap, restarting its recordings each time round', () => {
    let t = setLoop(build(), { on: true, start: 0, end: 2 })
    const { ctx, p, onEnd } = player(t)
    const created = vi.spyOn(ctx, 'createBufferSource')
    p.play(0)
    advance(ctx, 7)
    expect(created.mock.calls.length).toBeGreaterThanOrEqual(3) // the clip is queued again for each pass
    expect(p.position()).toBeLessThan(2.01)
    expect(onEnd).not.toHaveBeenCalled()
    p.stop()
  })

  test('stopping silences beats that were scheduled a moment ahead and leaves no timers', () => {
    let t = build()
    t = addBeatClip(t, 'b1', { id: 'bc', start: 0, bars: 2, pattern: PRESETS[0].pattern })
    const { ctx, p } = player(t)
    p.play(0)
    advance(ctx, 0.5)
    const gates = [...p.gates.values()]
    expect(gates.length).toBeGreaterThan(0)
    p.stop()
    for (const gate of gates) expect(gate.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))
    expect(vi.getTimerCount()).toBe(0)
  })

  test('refresh carries on from the same place after an edit', () => {
    const { ctx, p } = player()
    p.play(0)
    advance(ctx, 1)
    const before = p.position()
    p.refresh()
    expect(p.state).toBe('playing')
    advance(ctx, 0.1)
    expect(p.position()).toBeGreaterThanOrEqual(before)
    p.stop()
  })
})

describe('renderTimeline', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('mixes the whole song plus a tail into a WAV', async () => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
    const blob = await renderTimeline(build(), getBuffer, { sampleRate: 8000 })
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + Math.ceil((5 + 2.5) * 8000) * 4)
  })

  test('says so when there is nothing to export or the browser cannot', async () => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
    await expect(renderTimeline(emptyTimeline(), getBuffer)).rejects.toThrow(/nothing to export/)
    vi.stubGlobal('OfflineAudioContext', undefined)
    vi.stubGlobal('webkitOfflineAudioContext', undefined)
    await expect(renderTimeline(build(), getBuffer)).rejects.toThrow(/not supported/)
  })

  test('a muted track is left out of the loudness it contributes', async () => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
    const t = setTrack(build(), 'a1', { mute: true })
    await expect(renderTimeline(t, getBuffer, { sampleRate: 8000 })).resolves.toBeInstanceOf(Blob)
  })
})

describe('mixer', () => {
  test('applies volume, pan, EQ and reverb, with mute and solo deciding what is heard', () => {
    let { mixer, timeline } = setup()
    timeline = setTrack(timeline, 'a1', { volume: 0.7, pan: -0.5, reverb: 0.3, eq: { low: 4, mid: -2, high: 6 } })
    mixer.update(timeline)
    const strip = mixer.strip('a1')
    expect(strip.fader.gain.value).toBe(0.7)
    expect(strip.panner.pan.value).toBe(-0.5)
    expect(strip.send.gain.value).toBe(0.3)
    expect(strip.bands.map((b) => b.filter.gain.value)).toEqual([4, -2, 6])

    mixer.update(setTrack(timeline, 'b1', { solo: true }))
    expect(mixer.strip('a1').fader.gain.value).toBe(0)
    expect(mixer.strip('b1').fader.gain.value).toBe(1)
  })

  test('tracks added and removed later are followed', () => {
    const { mixer, timeline } = setup()
    mixer.update({ ...timeline, tracks: timeline.tracks.slice(0, 1) })
    expect(mixer.strip('b1')).toBeUndefined()
    mixer.update(addTrack(timeline, { kind: 'audio', id: 'a2' }))
    expect(mixer.strip('a2')).toBeDefined()
  })

  test('meters read a level for every track and the master', () => {
    const { mixer } = setup()
    const levels = mixer.levels()
    expect(levels.tracks.a1.level).toBeGreaterThan(0)
    expect(levels.master.level).toBeGreaterThan(0)
  })
})
