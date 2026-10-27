import { afterEach, describe, expect, test, vi } from 'vitest'
import { createRecorder, extensionFor, friendlyMicError, listInputs, openInput, pickMimeType } from './recorder.js'

class FakeMediaRecorder {
  static supported = ['audio/webm;codecs=opus', 'audio/webm']
  static isTypeSupported = (type) => FakeMediaRecorder.supported.includes(type)
  constructor(stream, options) {
    this.state = 'inactive'
    this.mimeType = options?.mimeType ?? ''
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['abc'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeMediaRecorder.supported = ['audio/webm;codecs=opus', 'audio/webm']
})

describe('pickMimeType', () => {
  test('prefers webm opus when available', () => {
    expect(pickMimeType(FakeMediaRecorder)).toBe('audio/webm;codecs=opus')
  })

  test('falls back to mp4 for Safari', () => {
    FakeMediaRecorder.supported = ['audio/mp4']
    expect(pickMimeType(FakeMediaRecorder)).toBe('audio/mp4')
  })

  test('returns an empty string when nothing is known', () => {
    FakeMediaRecorder.supported = []
    expect(pickMimeType(FakeMediaRecorder)).toBe('')
    expect(pickMimeType(undefined)).toBe('')
  })
})

describe('extensionFor', () => {
  test('maps mime types to file extensions', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionFor('audio/mp4')).toBe('m4a')
    expect(extensionFor('audio/ogg')).toBe('ogg')
    expect(extensionFor()).toBe('webm')
  })
})

describe('friendlyMicError', () => {
  test('gives plain advice for the common failures', () => {
    expect(friendlyMicError({ name: 'NotAllowedError' })).toMatch(/blocked/)
    expect(friendlyMicError({ name: 'NotFoundError' })).toMatch(/No microphone/)
    expect(friendlyMicError({ name: 'NotReadableError' })).toMatch(/Another app/)
    expect(friendlyMicError({ name: 'InsecureContextError' })).toMatch(/https/)
    expect(friendlyMicError(new Error('weird'))).toBe('Could not open the microphone.')
  })
})

describe('openInput and listInputs', () => {
  test('explains the secure-connection problem when mediaDevices is missing', async () => {
    vi.stubGlobal('navigator', {})
    await expect(openInput()).rejects.toMatchObject({ name: 'InsecureContextError' })
  })

  test('asks for clean, unprocessed audio', async () => {
    const getUserMedia = vi.fn(async () => ({}))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    await openInput('mic-9')
    const { audio } = getUserMedia.mock.calls[0][0]
    expect(audio.echoCancellation).toBe(false)
    expect(audio.deviceId).toEqual({ exact: 'mic-9' })
  })

  test('lists only microphones and names unlabeled ones', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: async () => [
          { kind: 'audioinput', deviceId: 'a', label: 'USB interface' },
          { kind: 'videoinput', deviceId: 'v', label: 'Camera' },
          { kind: 'audioinput', deviceId: 'b', label: '' },
        ],
      },
    })
    expect(await listInputs()).toEqual([
      { deviceId: 'a', label: 'USB interface' },
      { deviceId: 'b', label: 'Microphone 2' },
    ])
  })
})

describe('createRecorder', () => {
  test('records and returns a blob with its type and duration', async () => {
    const recorder = createRecorder({}, { MediaRecorderCtor: FakeMediaRecorder })
    recorder.start()
    const result = await recorder.stop()
    expect(result.blob.size).toBe(3)
    expect(result.mimeType).toBe('audio/webm;codecs=opus')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  test('explains when recording is unsupported', () => {
    expect(() => createRecorder({}, { MediaRecorderCtor: null })).toThrow(/not supported/)
  })
})
