import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeWorkletNode } from '../../tests/fakeAudio.js'
import { IDBFactory } from 'fake-indexeddb'
import { saveTake, listTakes } from '../storage/takes.js'
import { CAPTURE_WORKLET, assembleFrames, createCapture, estimateLatencySeconds, lastFrame, monoToWavBlob } from './capture.js'
import { COUNT_IN_BEATS, scheduleCountIn } from './countin.js'

describe('assembleFrames', () => {
  const chunk = (frame, values) => ({ frame, data: Float32Array.from(values) })

  test('joins blocks and cuts the clip exactly at the requested frames', () => {
    const chunks = [chunk(0, [1, 2, 3, 4]), chunk(4, [5, 6, 7, 8])]
    expect([...assembleFrames(chunks, 2, 7)]).toEqual([3, 4, 5, 6, 7])
  })

  test('fills a gap between blocks with silence', () => {
    const chunks = [chunk(0, [1, 1]), chunk(4, [2, 2])]
    expect([...assembleFrames(chunks, 0, 6)]).toEqual([1, 1, 0, 0, 2, 2])
  })

  test('pads the start with silence when capture began after the cut point', () => {
    expect([...assembleFrames([chunk(3, [9, 9])], 1, 5)]).toEqual([0, 0, 9, 9])
  })

  test('an empty range gives an empty clip', () => {
    expect(assembleFrames([chunk(0, [1, 2])], 5, 5)).toHaveLength(0)
    expect(assembleFrames([chunk(0, [1, 2])], 9, 3)).toHaveLength(0)
  })

  test('lastFrame is where the final block ends', () => {
    expect(lastFrame([chunk(0, [1, 2]), chunk(128, new Array(128).fill(0))])).toBe(256)
    expect(lastFrame([])).toBe(0)
  })
})

describe('estimateLatencySeconds', () => {
  test('adds output, context and microphone delays', () => {
    const ctx = { outputLatency: 0.04, baseLatency: 0.01 }
    const track = { getSettings: () => ({ latency: 0.02 }) }
    expect(estimateLatencySeconds(ctx, track)).toBeCloseTo(0.07)
  })

  test('browsers that report nothing count as zero', () => {
    expect(estimateLatencySeconds({}, undefined)).toBe(0)
    expect(estimateLatencySeconds({}, { getSettings: () => ({}) })).toBe(0)
  })
})

describe('monoToWavBlob', () => {
  test('makes a mono 16-bit WAV file', async () => {
    const blob = monoToWavBlob(new Float32Array([0, 0.5, -0.5]), 48000)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + 3 * 2)
    const view = new DataView(await blob.arrayBuffer())
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(48000)
  })
})

describe('capture worklet source', () => {
  test('reports the exact frame of every block and acknowledges stop', () => {
    expect(CAPTURE_WORKLET).toContain('currentFrame')
    expect(CAPTURE_WORKLET).toContain("registerProcessor('gala-capture'")
    expect(CAPTURE_WORKLET).toContain("type: 'stopped'")
    // the worklet text must at least be valid JavaScript apart from the audio-only globals
    expect(() => new Function('AudioWorkletProcessor', 'registerProcessor', 'currentFrame', CAPTURE_WORKLET)).not.toThrow()
  })
})

describe('createCapture', () => {
  beforeEach(() => {
    FakeWorkletNode.instances = []
    vi.stubGlobal('AudioWorkletNode', FakeWorkletNode)
    URL.createObjectURL = vi.fn(() => 'blob:worklet')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => vi.unstubAllGlobals())

  test('loads the worklet once per context and silences the output', async () => {
    const ctx = new FakeAudioContext()
    const source = ctx.createMediaStreamSource()
    await createCapture(ctx, source)
    await createCapture(ctx, source)
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  test('returns the blocks captured between start and stop', async () => {
    const ctx = new FakeAudioContext()
    const capture = await createCapture(ctx, ctx.createMediaStreamSource())
    const node = FakeWorkletNode.instances[0]
    capture.start()
    node.emit(0, new Float32Array(128))
    node.emit(128, new Float32Array(128))
    const chunks = await capture.stop()
    expect(node.port.postMessage).toHaveBeenCalledWith('start')
    expect(node.port.postMessage).toHaveBeenCalledWith('stop')
    expect(chunks.map((c) => c.frame)).toEqual([0, 128])
  })

  test('starting again throws away the previous clip', async () => {
    const ctx = new FakeAudioContext()
    const capture = await createCapture(ctx, ctx.createMediaStreamSource())
    const node = FakeWorkletNode.instances[0]
    capture.start()
    node.emit(0, new Float32Array(128))
    await capture.stop()
    capture.start()
    expect(await capture.stop()).toEqual([])
  })

  test('explains when the browser has no audio worklet', async () => {
    const ctx = new FakeAudioContext()
    ctx.audioWorklet = undefined
    await expect(createCapture(ctx, ctx.createMediaStreamSource())).rejects.toMatchObject({
      name: 'UnsupportedError',
      message: expect.stringMatching(/newer browser/),
    })
  })

  test('dispose disconnects everything', async () => {
    const ctx = new FakeAudioContext()
    const source = ctx.createMediaStreamSource()
    const capture = await createCapture(ctx, source)
    const node = FakeWorkletNode.instances[0]
    capture.dispose()
    expect(source.disconnect).toHaveBeenCalledWith(node)
    expect(node.disconnect).toHaveBeenCalled()
    expect(node.port.onmessage).toBeNull()
  })
})

describe('scheduleCountIn', () => {
  test('schedules one click per beat at the tempo, the first one higher', () => {
    const ctx = new FakeAudioContext()
    const oscillators = []
    const make = ctx.createOscillator
    ctx.createOscillator = () => {
      const node = make()
      oscillators.push(node)
      return node
    }
    scheduleCountIn(ctx, ctx.destination, 10, 120)
    expect(COUNT_IN_BEATS).toBe(4)
    expect(oscillators).toHaveLength(4)
    expect(oscillators.map((o) => o.start.mock.calls[0][0])).toEqual([10, 10.5, 11, 11.5])
    const hz = oscillators.map((o) => o.frequency.setValueAtTime.mock.calls[0][0])
    expect(hz[0]).toBeGreaterThan(hz[1])
    expect(hz[1]).toBe(hz[2])
  })
})

describe('take metadata', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
  })

  test('saves and returns the tempo a take was recorded at', async () => {
    await saveTake({ blob: new Blob(['x']), mimeType: 'audio/wav', durationMs: 1000, name: 'Take 1', meta: { bpm: 102, swing: 0.15 } })
    const [take] = await listTakes()
    expect(take.meta).toEqual({ bpm: 102, swing: 0.15 })
  })

  test('takes without metadata still work', async () => {
    await saveTake({ blob: new Blob(['x']), mimeType: 'audio/webm', durationMs: 1000, name: 'Take 1' })
    const [take] = await listTakes()
    expect(take.meta).toBeUndefined()
  })
})
