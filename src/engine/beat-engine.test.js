import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../tests/fakeAudio.js'
import {
  DRUM_LANES,
  STEPS,
  clearPattern,
  emptyPattern,
  normalizePattern,
  setMelodyStep,
  toggleDrum,
} from './pattern.js'
import { createMaster, playStep } from './playback.js'
import { renderBeat } from './render.js'
import { MELODY_ROWS, degreeToMidi, midiToFrequency, noteName } from './scale.js'
import { Sequencer, stepSeconds, swingDelay } from './sequencer.js'
import { DRUMS, SOUNDS } from './voices.js'
import { encodeWav } from './wav.js'

describe('scale maths', () => {
  test('A4 is 440 Hz and middle C is named C4', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440)
    expect(noteName(60)).toBe('C4')
  })

  test('degrees climb the scale and wrap into the next octave', () => {
    const base = { key: 0, scale: 'minor-pentatonic', octave: 4 }
    expect(degreeToMidi({ ...base, degree: 0 })).toBe(60) // C4
    expect(degreeToMidi({ ...base, degree: 1 })).toBe(63) // E flat
    expect(degreeToMidi({ ...base, degree: 5 })).toBe(72) // C5, one octave up after 5 notes
  })

  test('the key shifts every note', () => {
    expect(degreeToMidi({ degree: 0, key: 9, scale: 'major', octave: 4 })).toBe(69) // A4
  })
})

describe('pattern model', () => {
  test('starts empty with a lane for every drum', () => {
    const p = emptyPattern()
    expect(Object.keys(p.drums)).toEqual(DRUM_LANES.map((l) => l.id))
    expect(p.melody).toHaveLength(STEPS)
    expect(p.melody.every((d) => d === null)).toBe(true)
  })

  test('toggling does not mutate the original', () => {
    const p = emptyPattern()
    const next = toggleDrum(p, 'kick', 3)
    expect(next.drums.kick[3]).toBe(true)
    expect(p.drums.kick[3]).toBe(false)
    expect(toggleDrum(next, 'kick', 3).drums.kick[3]).toBe(false)
  })

  test('melody holds one note per step and the same note again clears it', () => {
    let p = setMelodyStep(emptyPattern(), 2, 3)
    expect(p.melody[2]).toBe(3)
    p = setMelodyStep(p, 2, 5)
    expect(p.melody[2]).toBe(5)
    p = setMelodyStep(p, 2, 5)
    expect(p.melody[2]).toBeNull()
  })

  test('clear keeps tempo and sound but empties the steps', () => {
    let p = toggleDrum({ ...emptyPattern(), bpm: 130, sound: 'lead' }, 'snare', 4)
    p = clearPattern(p)
    expect(p.drums.snare[4]).toBe(false)
    expect(p.bpm).toBe(130)
    expect(p.sound).toBe('lead')
  })

  test('normalizePattern repairs bad saved data', () => {
    const fixed = normalizePattern({ bpm: 9999, swing: -4, sound: 'banjo', key: 40, scale: 'x', melody: [99, 'a', 2] })
    expect(fixed.bpm).toBe(200)
    expect(fixed.swing).toBe(0)
    expect(fixed.sound).toBe('keys')
    expect(fixed.key).toBe(0)
    expect(fixed.scale).toBe('minor-pentatonic')
    expect(fixed.melody).toHaveLength(STEPS)
    expect(fixed.melody[0]).toBeNull()
    expect(fixed.melody[2]).toBe(2)
    expect(normalizePattern(null)).toEqual(emptyPattern())
    expect(normalizePattern('nonsense')).toEqual(emptyPattern())
  })

  test('every melody row maps to a playable note for every sound and key', () => {
    for (const sound of Object.keys(SOUNDS)) {
      for (let key = 0; key < 12; key++) {
        for (let degree = 0; degree < MELODY_ROWS; degree++) {
          const midi = degreeToMidi({ degree, key, scale: 'natural-minor', octave: SOUNDS[sound].octave })
          expect(midiToFrequency(midi)).toBeGreaterThan(20)
          expect(midiToFrequency(midi)).toBeLessThan(5000)
        }
      }
    }
  })
})

describe('sequencer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('step length follows tempo', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125)
    expect(stepSeconds(60)).toBeCloseTo(0.25)
  })

  test('swing only delays the off-beat steps', () => {
    expect(swingDelay(0, 120, 1)).toBe(0)
    expect(swingDelay(1, 120, 0)).toBe(0)
    expect(swingDelay(1, 120, 1)).toBeCloseTo(0.33 * 0.125)
  })

  test('schedules steps ahead of the audio clock, in order, and loops after 16', () => {
    let now = 0
    const played = []
    const seq = new Sequencer({
      getTime: () => now,
      getBpm: () => 120,
      getSwing: () => 0,
      play: (step, time) => played.push([step, time]),
    })
    seq.start()
    expect(played.map((p) => p[0])).toEqual([0])

    now = 0.2
    vi.advanceTimersByTime(25)
    expect(played.map((p) => p[0])).toEqual([0, 1, 2])
    expect(played[1][1] - played[0][1]).toBeCloseTo(0.125)

    for (let i = 0; i < 40; i++) {
      now += 0.1
      vi.advanceTimersByTime(25)
    }
    const steps = played.map((p) => p[0])
    expect(steps.slice(14, 18)).toEqual([14, 15, 0, 1])
    seq.stop()
  })

  test('stop halts scheduling and tempo changes apply on the next step', () => {
    let now = 0
    let bpm = 120
    const played = []
    const seq = new Sequencer({
      getTime: () => now,
      getBpm: () => bpm,
      getSwing: () => 0,
      play: (step, time) => played.push(time),
    })
    seq.start()
    bpm = 60
    now = 1
    vi.advanceTimersByTime(25)
    const gap = played[played.length - 1] - played[played.length - 2]
    expect(gap).toBeCloseTo(0.25)
    seq.stop()
    const count = played.length
    now = 5
    vi.advanceTimersByTime(200)
    expect(played.length).toBe(count)
  })
})

describe('playStep', () => {
  test('triggers exactly the drums that are switched on, plus the melody note', () => {
    const ctx = new FakeAudioContext()
    const master = createMaster(ctx)
    let pattern = toggleDrum(emptyPattern(), 'kick', 0)
    pattern = toggleDrum(pattern, 'hat', 0)
    pattern = setMelodyStep(pattern, 0, 2)

    const kick = vi.spyOn(DRUMS, 'kick')
    const hat = vi.spyOn(DRUMS, 'hat')
    const snare = vi.spyOn(DRUMS, 'snare')
    const oscillators = vi.spyOn(ctx, 'createOscillator')

    playStep(ctx, master.input, pattern, 0, 1)
    expect(kick).toHaveBeenCalledOnce()
    expect(hat).toHaveBeenCalledOnce()
    expect(snare).not.toHaveBeenCalled()
    // kick uses one oscillator, the melody note uses one more
    expect(oscillators).toHaveBeenCalledTimes(2)

    oscillators.mockClear()
    playStep(ctx, master.input, pattern, 1, 1.2)
    expect(oscillators).not.toHaveBeenCalled()
  })

  test('every drum voice can be triggered without errors', () => {
    const ctx = new FakeAudioContext()
    const master = createMaster(ctx)
    for (const lane of DRUM_LANES) expect(() => DRUMS[lane.id](ctx, master.input, 0)).not.toThrow()
  })
})

describe('encodeWav', () => {
  test('writes a valid 16-bit stereo header and clamps samples', () => {
    const left = new Float32Array([0, 1, -1, 2])
    const right = new Float32Array([0, 0, 0, -2])
    const buffer = encodeWav([left, right], 44100)
    const view = new DataView(buffer)
    const text = (o, n) => String.fromCharCode(...new Uint8Array(buffer, o, n))

    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(text(36, 4)).toBe('data')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(40, true)).toBe(4 * 2 * 2)
    expect(buffer.byteLength).toBe(44 + 16)
    expect(view.getInt16(44 + 4, true)).toBe(32767) // left, frame 1
    expect(view.getInt16(44 + 8, true)).toBe(-32768) // left, frame 2
    expect(view.getInt16(44 + 12, true)).toBe(32767) // left, frame 3 clamped from 2
    expect(view.getInt16(44 + 14, true)).toBe(-32768) // right, frame 3 clamped from -2
  })
})

describe('renderBeat', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('renders the requested bars plus a tail into a WAV blob', async () => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
    const pattern = toggleDrum({ ...emptyPattern(), bpm: 120 }, 'kick', 0)
    const blob = await renderBeat(pattern, { bars: 2, sampleRate: 8000 })
    const frames = Math.ceil((2 * 2 + 1.5) * 8000)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + frames * 4)
  })

  test('explains when the browser cannot export', async () => {
    vi.stubGlobal('OfflineAudioContext', undefined)
    vi.stubGlobal('webkitOfflineAudioContext', undefined)
    await expect(renderBeat(emptyPattern())).rejects.toThrow(/not supported/)
  })
})
