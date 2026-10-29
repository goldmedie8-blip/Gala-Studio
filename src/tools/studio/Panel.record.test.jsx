import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext, FakeWorkletNode } from '../../../tests/fakeAudio.js'
import { getAudioContext, resetAudioContextForTests } from '../../engine/audioContext.js'
import { listTakes, saveTake } from '../../storage/takes.js'
import { PRESETS } from '../beats/presets.js'
import Panel from './Panel.jsx'

const track = { stop: vi.fn(), getSettings: () => ({ deviceId: 'mic-1' }) }
const stream = { getTracks: () => [track], getAudioTracks: () => [track] }

function mockMicrophone(getUserMedia = vi.fn(async () => stream)) {
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

const renderPanel = () =>
  render(
    <MemoryRouter>
      <Panel />
    </MemoryRouter>,
  )

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  FakeWorkletNode.instances = []
  track.stop.mockClear()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
  vi.stubGlobal('AudioWorkletNode', FakeWorkletNode)
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  mockMicrophone()
})

afterEach(() => {
  resetAudioContextForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const startButton = () => screen.getByRole('button', { name: 'Start recording' })

async function enableMic(user) {
  await user.click(screen.getByRole('button', { name: /enable microphone/i }))
  await screen.findByRole('combobox', { name: 'Input' })
}

// Presses record, plays "sound" into the capture node (as the microphone would), presses stop.
async function recordTake(user, { frame = 100000, length = 100000 } = {}) {
  await user.click(startButton())
  await screen.findByRole('button', { name: 'Stop recording' })
  FakeWorkletNode.instances.at(-1).emit(frame, new Float32Array(length).fill(0.1))
  await user.click(screen.getByRole('button', { name: 'Stop recording' }))
  await screen.findByRole('button', { name: 'Start recording' })
}

describe('Record over the beat: setup', () => {
  test('tells you to wear headphones and asks for the microphone first', () => {
    renderPanel()
    expect(screen.getByText(/Wear headphones/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enable microphone/i })).toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })

  test('enabling shows the inputs, a live level meter and a count-in that is on by default', async () => {
    const user = userEvent.setup()
    renderPanel()
    await enableMic(user)
    expect(screen.getByRole('option', { name: 'USB interface' })).toBeInTheDocument()
    expect(startButton()).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: /count in/i })).toBeChecked()
    await waitFor(() => expect(Number(screen.getByRole('meter').getAttribute('aria-valuenow'))).toBeGreaterThan(0))
  })

  test('explains what to do when the microphone is blocked', async () => {
    mockMicrophone(vi.fn(async () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))))
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /enable microphone/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked/)
    expect(screen.getByRole('button', { name: /enable microphone/i })).toBeInTheDocument()
  })

  test('says so when the browser cannot capture audio accurately', async () => {
    vi.stubGlobal('AudioWorkletNode', undefined)
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /enable microphone/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/newer browser/)
    expect(track.stop).toHaveBeenCalled() // the microphone is released again
  })
})

describe('Record over the beat: recording', () => {
  test('records a take over the beat, saves it with its tempo, and selects it', async () => {
    const user = userEvent.setup()
    renderPanel()
    await enableMic(user)
    await recordTake(user)

    const option = await screen.findByRole('radio', { name: /Take 1/ })
    expect(option).toBeChecked()

    const [saved] = await listTakes()
    expect(saved.mimeType).toBe('audio/wav')
    expect(saved.meta.bpm).toBe(PRESETS[0].pattern.bpm)
    // 100000 frames captured from frame 100000, cut where the beat starts (after a 4 beat count-in)
    expect(saved.durationMs).toBeGreaterThan(1900)
    expect(saved.durationMs).toBeLessThan(2100)

    expect(await screen.findByText(new RegExp(`Recorded over a ${PRESETS[0].pattern.bpm} BPM beat`))).toBeInTheDocument()
    expect(screen.getByText('0.00 s')).toBeInTheDocument() // lined up from zero, no manual nudging
  })

  test('the beat is locked while recording so the take always matches it', async () => {
    const user = userEvent.setup()
    await saveTake({ blob: new Blob(['v']), mimeType: 'audio/webm', durationMs: 2000, name: 'Take 1' })
    renderPanel()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled())
    await enableMic(user)

    await user.click(startButton())
    expect(await screen.findByText('Get ready...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Faster' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Trap' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Take 1/ })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Input' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Stop recording' }))
    await screen.findByRole('alert') // nothing was sung, so the take is too short
    expect(screen.getByRole('button', { name: 'Faster' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled()
  })

  test('a take cut before the singing starts is rejected instead of saving silence', async () => {
    const user = userEvent.setup()
    renderPanel()
    await enableMic(user)
    // sound only from the count-in, which is cut away
    await user.click(startButton())
    await screen.findByRole('button', { name: 'Stop recording' })
    FakeWorkletNode.instances.at(-1).emit(0, new Float32Array(50000).fill(0.1))
    await user.click(screen.getByRole('button', { name: 'Stop recording' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too short/)
    expect(await listTakes()).toEqual([])
  })

  test('with the count-in off the take starts right away', async () => {
    const user = userEvent.setup()
    renderPanel()
    await enableMic(user)
    await user.click(screen.getByRole('checkbox', { name: /count in/i }))
    await recordTake(user, { frame: 0, length: 50000 })
    const [saved] = await listTakes()
    // 50000 frames from the start, minus the 0.15 s start-up gap
    expect(saved.durationMs).toBeGreaterThan(900)
    expect(saved.durationMs).toBeLessThan(1100)
  })

  test('the timing fix trims the start of the take and is remembered', async () => {
    const user = userEvent.setup()
    renderPanel()
    await enableMic(user)
    await recordTake(user)

    fireEvent.change(screen.getByLabelText(/Voice sync/), { target: { value: '100' } })
    expect(screen.getByLabelText('Voice sync +100 ms')).toBeInTheDocument()
    expect(localStorage.getItem('gala.sync.v1')).toBe('100')
    await recordTake(user)

    const [second, first] = await listTakes()
    expect(first.durationMs - second.durationMs).toBeGreaterThan(90)
    expect(first.durationMs - second.durationMs).toBeLessThan(110)
    expect(second.meta.syncMs).toBe(100)
  })

  test('uses the delay the browser reports for the headphones', async () => {
    const user = userEvent.setup()
    renderPanel()
    await enableMic(user)
    await recordTake(user)
    getAudioContext().outputLatency = 0.05
    await recordTake(user)
    const [second, first] = await listTakes()
    expect(first.durationMs - second.durationMs).toBeGreaterThan(40)
    expect(first.durationMs - second.durationMs).toBeLessThan(60)
  })

  test('a remembered timing fix is applied on the next visit', async () => {
    localStorage.setItem('gala.sync.v1', '-40')
    const user = userEvent.setup()
    renderPanel()
    await enableMic(user)
    expect(screen.getByLabelText('Voice sync -40 ms')).toBeInTheDocument()
    await recordTake(user)
    const [saved] = await listTakes()
    expect(saved.meta.syncMs).toBe(-40)
  })
})

describe('Record over the beat: coming back to a take', () => {
  test('choosing a take brings back the tempo it was recorded at', async () => {
    await saveTake({
      blob: new Blob(['v']),
      mimeType: 'audio/wav',
      durationMs: 2000,
      name: 'Take 1',
      meta: { bpm: 128, swing: 0 },
    })
    renderPanel()
    await waitFor(() => expect(screen.getByLabelText('Tempo in beats per minute')).toHaveValue(128))
    expect(await screen.findByText(/Recorded over a 128 BPM beat/)).toBeInTheDocument()
  })
})

describe('Record over the beat: cleanup', () => {
  test('leaving the screen releases the microphone', async () => {
    const user = userEvent.setup()
    const view = renderPanel()
    await enableMic(user)
    track.stop.mockClear()
    view.unmount()
    expect(track.stop).toHaveBeenCalled()
  })

  test('leaving the screen mid-recording stops the beat and the microphone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const view = renderPanel()
    await enableMic(user)
    await user.click(startButton())
    await screen.findByRole('button', { name: 'Stop recording' })
    track.stop.mockClear()
    view.unmount()
    expect(track.stop).toHaveBeenCalled()
    expect(FakeWorkletNode.instances[0].disconnect).toHaveBeenCalled() // capture node removed from the audio graph
    expect(vi.getTimerCount()).toBe(0) // the beat scheduler and clock are stopped
  })
})
