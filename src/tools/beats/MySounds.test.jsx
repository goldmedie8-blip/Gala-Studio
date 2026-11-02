import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { readKit, setLaneSound } from '../../engine/drumKit.js'
import { playDrum } from '../../engine/playback.js'
import { listTakes } from '../../storage/takes.js'
import MySounds from './MySounds.jsx'

// Recordings and decoding are tested in their own files. Here the card is checked with those parts replaced.
vi.mock('../../storage/takes.js', () => ({ listTakes: vi.fn(), getTake: vi.fn() }))
vi.mock('../../engine/drumKit.js', () => ({ readKit: vi.fn(), setLaneSound: vi.fn() }))
vi.mock('../../engine/audioContext.js', () => ({ unlockAudio: vi.fn(async () => ({ currentTime: 0 })) }))
vi.mock('../../engine/playback.js', () => ({ createMaster: vi.fn((ctx) => ({ ctx, input: { master: true } })), playDrum: vi.fn() }))

const TAKES = [
  { id: 'a', name: 'Take 2', durationMs: 900 },
  { id: 'b', name: 'Take 1', durationMs: 65000 },
]
let kit

beforeEach(() => {
  kit = {}
  vi.clearAllMocks()
  listTakes.mockImplementation(() => Promise.resolve(TAKES))
  readKit.mockImplementation(() => ({ ...kit }))
  setLaneSound.mockImplementation(async (lane, id) => {
    if (id) kit[lane] = id
    else delete kit[lane]
  })
})

// The section starts closed, so open it the way a person would, then let the recordings finish loading.
async function show() {
  render(<MySounds />)
  act(() => {
    document.querySelector('details').open = true
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}
const select = (lane) => screen.getByRole('combobox', { name: `${lane} sound` })

describe('My sounds', () => {
  test('every drum can be given a recording, and starts on its built-in sound', async () => {
    await show()
    for (const lane of ['Kick', 'Snare', 'Clap', 'Hi-hat', 'Open hat', 'Perc', 'Rim', 'Shaker', 'Conga', 'Cowbell']) {
      expect(select(lane)).toHaveValue('')
    }
  })

  test('your recordings are listed with their length', async () => {
    await show()
    const options = within(select('Kick')).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Built-in sound', 'Take 2 (0:01)', 'Take 1 (1:05)'])
  })

  test('with no recordings it says what to do', async () => {
    listTakes.mockImplementation(() => Promise.resolve([]))
    await show()
    expect(await screen.findByText(/You have no recordings yet/)).toBeInTheDocument()
  })

  test('choosing a recording sets it for that drum and counts it', async () => {
    const user = userEvent.setup()
    await show()
    await user.selectOptions(select('Conga'), 'a')
    expect(setLaneSound).toHaveBeenCalledWith('conga', 'a')
    expect(select('Conga')).toHaveValue('a')
    expect(screen.getByText('My sounds (1 in use)')).toBeInTheDocument()
  })

  test('going back to the built-in sound clears it', async () => {
    const user = userEvent.setup()
    kit = { kick: 'a' }
    await show()
    expect(select('Kick')).toHaveValue('a')
    await user.selectOptions(select('Kick'), '')
    expect(setLaneSound).toHaveBeenCalledWith('kick', '')
    expect(select('Kick')).toHaveValue('')
  })

  test('a recording that cannot be used shows why and keeps the old choice', async () => {
    const user = userEvent.setup()
    setLaneSound.mockRejectedValueOnce(new Error('That recording could not be used as a sound.'))
    await show()
    await user.selectOptions(select('Snare'), 'a')
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be used as a sound')
    expect(select('Snare')).toHaveValue('')
  })

  test('a deleted recording is flagged instead of breaking the list', async () => {
    kit = { perc: 'gone' }
    await show()
    expect(await screen.findByRole('option', { name: 'Recording not found' })).toBeInTheDocument()
  })

  test('preview plays that drum', async () => {
    const user = userEvent.setup()
    await show()
    await user.click(screen.getByRole('button', { name: 'Preview Cowbell sound' }))
    expect(playDrum).toHaveBeenCalledWith({ currentTime: 0 }, { master: true }, 'cowbell', expect.any(Number))
  })
})
