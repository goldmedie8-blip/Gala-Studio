import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import Panel from './Panel.jsx'

class FakeMediaRecorder {
  static isTypeSupported = () => true
  constructor(stream, options) {
    this.state = 'inactive'
    this.mimeType = options?.mimeType ?? 'audio/webm'
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

class FakeAudioContext {
  state = 'running'
  createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  createAnalyser = () => ({
    fftSize: 0,
    connect: vi.fn(),
    getFloatTimeDomainData: (buffer) => buffer.fill(0.2),
  })
}

const track = { stop: vi.fn(), getSettings: () => ({ deviceId: 'mic-1' }) }
const stream = { getTracks: () => [track], getAudioTracks: () => [track] }

function mockMicrophone(getUserMedia) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'mic-1', label: 'Built-in microphone' },
        { kind: 'audioinput', deviceId: 'mic-2', label: 'USB interface' },
      ],
    },
  })
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
  mockMicrophone(vi.fn(async () => stream))
})

afterEach(() => {
  resetAudioContextForTests()
  vi.unstubAllGlobals()
})

async function enableMic(user) {
  await user.click(screen.getByRole('button', { name: /enable microphone/i }))
  await screen.findByRole('combobox', { name: 'Input' })
}

describe('Record panel', () => {
  test('asks for the microphone first, then shows inputs and a live meter', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    expect(screen.getByRole('heading', { name: 'Set up your microphone' })).toBeInTheDocument()

    await enableMic(user)
    expect(screen.getByRole('option', { name: 'USB interface' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
    await waitFor(() => expect(Number(screen.getByRole('meter').getAttribute('aria-valuenow'))).toBeGreaterThan(0))
  })

  test('explains what to do when the microphone is blocked', async () => {
    mockMicrophone(vi.fn(async () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))))
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: /enable microphone/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked/)
    expect(screen.getByRole('button', { name: /enable microphone/i })).toBeInTheDocument()
  })

  test('records a take, then plays, downloads and deletes it', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await enableMic(user)

    await user.click(screen.getByRole('button', { name: 'Record' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    const list = await screen.findByRole('list')
    expect(within(list).getByText('Take 1')).toBeInTheDocument()
    expect(await within(list).findByLabelText('Play Take 1')).toBeInTheDocument()
    expect(within(list).getByRole('link', { name: /download/i })).toHaveAttribute('download', 'gala-take-1.webm')

    await user.click(within(list).getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(screen.queryByText('Take 1')).not.toBeInTheDocument())
  })

  test('numbers takes in order and keeps them after the page is reopened', async () => {
    const user = userEvent.setup()
    const first = render(<Panel />)
    await enableMic(user)
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'Record' }))
      await user.click(screen.getByRole('button', { name: 'Stop' }))
      await screen.findByText(`Take ${i + 1}`)
    }
    first.unmount()

    render(<Panel />)
    expect(await screen.findByText('Take 2')).toBeInTheDocument()
    expect(screen.getByText('Take 1')).toBeInTheDocument()
  })

  test('releases the microphone when the panel closes', async () => {
    const user = userEvent.setup()
    const view = render(<Panel />)
    await enableMic(user)
    track.stop.mockClear()
    await act(async () => view.unmount())
    expect(track.stop).toHaveBeenCalled()
  })
})
