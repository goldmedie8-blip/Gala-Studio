// Microphone access and recording. Pure browser APIs, no React, so it is easy to test.
import { audioInputConstraints } from './constraints.js'

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

// Chrome and Android record webm/opus, Safari records mp4. Ask the browser what it can do.
export function pickMimeType(MediaRecorderCtor = globalThis.MediaRecorder) {
  if (!MediaRecorderCtor?.isTypeSupported) return ''
  return MIME_CANDIDATES.find((type) => MediaRecorderCtor.isTypeSupported(type)) ?? ''
}

export function extensionFor(mimeType = '') {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export async function openInput(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error('Microphone needs a secure connection')
    error.name = 'InsecureContextError'
    throw error
  }
  return navigator.mediaDevices.getUserMedia(audioInputConstraints(deviceId))
}

// Device names are only filled in after the person has allowed the microphone once.
export async function listInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
}

export function friendlyMicError(error) {
  switch (error?.name) {
    case 'InsecureContextError':
      return 'The microphone only works on a secure connection. Open the app from https:// or from localhost.'
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Microphone access was blocked. Tap the lock icon next to the address, allow the microphone, then try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone found. Plug one in or check your device settings.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Another app is using the microphone. Close it and try again.'
    case 'OverconstrainedError':
      return 'That input is no longer available. Pick another one from the list.'
    default:
      return 'Could not open the microphone.'
  }
}

export function createRecorder(stream, { MediaRecorderCtor = globalThis.MediaRecorder } = {}) {
  if (!MediaRecorderCtor) throw new Error('Recording is not supported in this browser.')
  const mimeType = pickMimeType(MediaRecorderCtor)
  const recorder = new MediaRecorderCtor(stream, mimeType ? { mimeType } : undefined)
  const chunks = []
  let startedAt = 0

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  }

  return {
    start() {
      chunks.length = 0
      startedAt = performance.now()
      recorder.start()
    },
    stop() {
      return new Promise((resolve, reject) => {
        recorder.onerror = (event) => reject(event.error ?? new Error('Recording failed'))
        recorder.onstop = () => {
          const type = recorder.mimeType || mimeType || 'audio/webm'
          resolve({
            blob: new Blob(chunks, { type }),
            mimeType: type,
            durationMs: Math.round(performance.now() - startedAt),
          })
        }
        if (recorder.state === 'inactive') recorder.onstop()
        else recorder.stop()
      })
    },
  }
}
