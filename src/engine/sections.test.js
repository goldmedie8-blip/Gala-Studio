import { describe, expect, test, vi } from 'vitest'
import { FakeAudioContext } from '../../tests/fakeAudio.js'
import { PRESETS } from '../tools/beats/presets.js'
import {
  MAX_BARS,
  SECTION_COUNT,
  STEPS,
  addBar,
  arrangementLength,
  clearPattern,
  copySection,
  emptyPattern,
  locateStep,
  loopSection,
  normalizePattern,
  removeBar,
  setBarSection,
  setBassStep,
  setMelodyStep,
  switchSection,
  toggleDrum,
} from './pattern.js'
import { createMaster, playStep } from './playback.js'
import { renderBeat } from './render.js'
import { Sequencer } from './sequencer.js'
import { DRUMS } from './voices.js'
import { FakeOfflineAudioContext } from '../../tests/fakeAudio.js'

describe('sections', () => {
  test('switching sections keeps the work in each one', () => {
    let p = toggleDrum(emptyPattern(), 'kick', 0)
    p = switchSection(p, 1)
    expect(p.active).toBe(1)
    expect(p.drums.kick[0]).toBe(false)
    p = toggleDrum(p, 'snare', 4)
    p = switchSection(p, 0)
    expect(p.drums.kick[0]).toBe(true)
    expect(p.drums.snare[4]).toBe(false)
    p = switchSection(p, 1)
    expect(p.drums.snare[4]).toBe(true)
    expect(p.drums.kick[0]).toBe(false)
  })

  test('copying fills the open section from another and does not link them', () => {
    let p = toggleDrum(emptyPattern(), 'kick', 2)
    p = setBassStep(setMelodyStep(p, 3, 4), 5, 1)
    p = switchSection(p, 2)
    p = copySection(p, 0)
    expect(p.drums.kick[2]).toBe(true)
    expect(p.melody[3]).toBe(4)
    expect(p.bass[5]).toBe(1)
    p = toggleDrum(p, 'kick', 2)
    p = switchSection(p, 0)
    expect(p.drums.kick[2]).toBe(true)
  })

  test('clear empties only the open section', () => {
    let p = toggleDrum(emptyPattern(), 'kick', 0)
    p = switchSection(toggleDrum(switchSection(p, 1), 'kick', 1), 0)
    p = clearPattern(p)
    expect(p.drums.kick[0]).toBe(false)
    expect(switchSection(p, 1).drums.kick[1]).toBe(true)
  })

  test('the arrangement can grow and shrink within limits', () => {
    let p = emptyPattern()
    expect(removeBar(p).order).toEqual([0])
    p = switchSection(addBar(p), 2)
    expect(p.order).toEqual([0, 0])
    p = setBarSection(addBar(p), 1, 3)
    expect(p.order).toEqual([0, 3, 2])
    expect(setBarSection(p, 9, 1)).toBe(p)
    expect(setBarSection(p, 0, 7)).toBe(p)
    for (let i = 0; i < 30; i++) p = addBar(p)
    expect(p.order).toHaveLength(MAX_BARS)
    expect(removeBar(p).order).toHaveLength(MAX_BARS - 1)
  })

  test('locateStep finds the bar, the step in it and the section that plays', () => {
    const p = { ...emptyPattern(), order: [0, 2, 1] }
    expect(arrangementLength(p)).toBe(3 * STEPS)
    expect(locateStep(p, 0)).toMatchObject({ bar: 0, local: 0, index: 0 })
    expect(locateStep(p, STEPS + 5)).toMatchObject({ bar: 1, local: 5, index: 2 })
    expect(locateStep(p, 3 * STEPS)).toMatchObject({ bar: 0, local: 0, index: 0 })
  })

  test('loopSection plays only the open section, whichever it is', () => {
    const p = switchSection({ ...emptyPattern(), order: [0, 1, 2] }, 3)
    expect(loopSection(p).order).toEqual([3])
  })

  test('an old save without sections loads as one section', () => {
    const old = { bpm: 110, sound: 'keys', drums: { kick: [true, ...Array(15).fill(false)] }, melody: [2] }
    const fixed = normalizePattern(old)
    expect(fixed.drums.kick[0]).toBe(true)
    expect(fixed.melody[0]).toBe(2)
    expect(fixed.order).toEqual([0])
    expect(fixed.sections).toHaveLength(SECTION_COUNT)
    expect(fixed.drums.cowbell).toHaveLength(STEPS)
    expect(fixed.bass).toHaveLength(STEPS)
  })

  test('bad sections and arrangements are repaired', () => {
    const fixed = normalizePattern({ active: 9, order: [0, 9, 'a', 1], bassSound: 'banjo', sections: 'nope' })
    expect(fixed.active).toBe(0)
    expect(fixed.order).toEqual([0, 1])
    expect(fixed.bassSound).toBe('bass')
    expect(fixed.sections).toHaveLength(SECTION_COUNT)
    expect(normalizePattern({ order: [] }).order).toEqual([0])
  })

  test('a normalised pattern normalises to itself', () => {
    for (const { pattern } of PRESETS) expect(normalizePattern(pattern)).toEqual(pattern)
  })
})

describe('playing an arrangement', () => {
  test('each bar plays the drums of its own section', () => {
    const ctx = new FakeAudioContext()
    const master = createMaster(ctx)
    let p = { ...emptyPattern(), order: [0, 1] }
    p = toggleDrum(p, 'kick', 0)
    p = switchSection(p, 1)
    p = toggleDrum(p, 'snare', 0)
    p = switchSection(p, 0)
    const kick = vi.spyOn(DRUMS, 'kick')
    const snare = vi.spyOn(DRUMS, 'snare')

    playStep(ctx, master.input, p, 0, 1)
    expect([kick.mock.calls.length, snare.mock.calls.length]).toEqual([1, 0])
    playStep(ctx, master.input, p, STEPS, 2)
    expect([kick.mock.calls.length, snare.mock.calls.length]).toEqual([1, 1])
    playStep(ctx, master.input, p, 2 * STEPS, 3)
    expect([kick.mock.calls.length, snare.mock.calls.length]).toEqual([2, 1])
    kick.mockRestore()
    snare.mockRestore()
  })

  test('the open section is heard as you edit it, not an old copy', () => {
    const ctx = new FakeAudioContext()
    const master = createMaster(ctx)
    let p = switchSection({ ...emptyPattern(), order: [1] }, 1)
    p = toggleDrum(p, 'hat', 0)
    const hat = vi.spyOn(DRUMS, 'hat')
    playStep(ctx, master.input, p, 0, 1)
    expect(hat).toHaveBeenCalledOnce()
    hat.mockRestore()
  })

  test('the bass line plays its own sound alongside the melody', () => {
    const ctx = new FakeAudioContext()
    const master = createMaster(ctx)
    const p = setBassStep(setMelodyStep(emptyPattern(), 0, 2), 0, 0)
    const oscillators = vi.spyOn(ctx, 'createOscillator')
    playStep(ctx, master.input, p, 0, 1)
    expect(oscillators).toHaveBeenCalledTimes(2)
  })

  test('the sequencer runs the whole arrangement before it loops', () => {
    vi.useFakeTimers()
    let now = 0
    const played = []
    const seq = new Sequencer({
      getTime: () => now,
      getBpm: () => 240,
      getSwing: () => 0,
      getLength: () => 2 * STEPS,
      play: (step) => played.push(step),
    })
    seq.start()
    for (let i = 0; i < 60; i++) {
      now += 0.1
      vi.advanceTimersByTime(25)
    }
    seq.stop()
    expect(played.slice(30, 35)).toEqual([30, 31, 0, 1, 2])
    expect(Math.max(...played)).toBe(2 * STEPS - 1)
    vi.useRealTimers()
  })

  test('rendering without a bar count renders the whole arrangement', async () => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
    const p = { ...emptyPattern(), bpm: 120, order: [0, 0, 0] }
    const blob = await renderBeat(p, { sampleRate: 8000 })
    expect(blob.size).toBe(44 + Math.ceil((3 * 2 + 1.5) * 8000) * 4)
    vi.unstubAllGlobals()
  })
})

describe('style presets', () => {
  test('there is real choice of styles', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
    expect(new Set(PRESETS.map((p) => p.pattern.bpm)).size).toBeGreaterThanOrEqual(8)
  })

  test('every style has a groove, a hook, a break and a fill that differ from each other', () => {
    for (const { id, pattern } of PRESETS) {
      const sections = [0, 1, 2, 3].map((i) => JSON.stringify(switchSection(pattern, i).drums) + JSON.stringify(switchSection(pattern, i).melody))
      expect(new Set(sections).size, id).toBe(4)
      expect(pattern.order.length, id).toBeGreaterThanOrEqual(4)
      expect(new Set(pattern.order).size, id).toBeGreaterThanOrEqual(2)
      expect(pattern.bass.some((d) => d !== null), id).toBe(true)
    }
  })
})
