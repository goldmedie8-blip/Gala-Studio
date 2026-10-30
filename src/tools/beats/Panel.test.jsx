import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../../tests/fakeAudio.js'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import { STEPS } from '../../engine/pattern.js'
import Panel from './Panel.jsx'
import { PRESETS } from './presets.js'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
  URL.createObjectURL = vi.fn(() => 'blob:beat')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  resetAudioContextForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const kickCells = () => within(screen.getByRole('group', { name: 'Kick steps' })).getAllByRole('button')

describe('presets', () => {
  test('every preset is a full, valid pattern with something to hear', () => {
    for (const { pattern } of PRESETS) {
      expect(pattern.melody).toHaveLength(STEPS)
      expect(Object.values(pattern.drums).every((row) => row.length === STEPS)).toBe(true)
      expect(pattern.drums.kick.some(Boolean)).toBe(true)
      expect(pattern.bpm).toBeGreaterThanOrEqual(60)
      expect(pattern.bpm).toBeLessThanOrEqual(200)
    }
  })
})

describe('Beats panel', () => {
  test('opens with a ready-made beat so there is sound straight away', () => {
    render(<Panel />)
    expect(kickCells()).toHaveLength(16)
    expect(kickCells().some((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true)
    expect(screen.getByLabelText('Tempo in beats per minute')).toHaveValue(PRESETS[0].pattern.bpm)
  })

  test('tapping a step switches it on and off', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: /clear/i }))
    const cell = screen.getByRole('button', { name: 'Kick step 1' })
    expect(cell).toHaveAttribute('aria-pressed', 'false')
    await user.click(cell)
    expect(cell).toHaveAttribute('aria-pressed', 'true')
    await user.click(cell)
    expect(cell).toHaveAttribute('aria-pressed', 'false')
  })

  test('a melody step holds one note at a time', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: /clear/i }))
    const grid = (name) => screen.getAllByRole('button', { name: new RegExp(`^${name} step 1$`) })[0]
    const rows = screen.getAllByRole('group', { name: /^Note .* steps$/ })
    expect(rows).toHaveLength(8)
    const first = within(rows[0]).getAllByRole('button')[0]
    const second = within(rows[1]).getAllByRole('button')[0]
    await user.click(first)
    expect(first).toHaveAttribute('aria-pressed', 'true')
    await user.click(second)
    expect(second).toHaveAttribute('aria-pressed', 'true')
    expect(first).toHaveAttribute('aria-pressed', 'false')
    expect(grid).toBeDefined()
  })

  test('changing the key renames every note in the grid', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    const before = screen.getAllByRole('group', { name: /^Note .* steps$/ }).map((g) => g.getAttribute('aria-label'))
    await user.selectOptions(screen.getByLabelText('Key'), 'F#')
    const after = screen.getAllByRole('group', { name: /^Note .* steps$/ }).map((g) => g.getAttribute('aria-label'))
    expect(after).not.toEqual(before)
  })

  test('tempo buttons and typing stay inside 60 to 200', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    const bpm = screen.getByLabelText('Tempo in beats per minute')
    const start = Number(bpm.value)
    await user.click(screen.getByRole('button', { name: 'Faster' }))
    expect(bpm).toHaveValue(start + 1)
    await user.click(screen.getByRole('button', { name: 'Slower' }))
    expect(bpm).toHaveValue(start)
    await user.clear(bpm)
    await user.type(bpm, '999')
    await user.tab() // out-of-range numbers are clamped when you leave the box
    expect(bpm).toHaveValue(200)
  })

  test('typing a tempo works: clearing the box does not snap it to another number', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    const bpm = screen.getByLabelText('Tempo in beats per minute')
    await user.clear(bpm)
    expect(bpm).toHaveValue(null)
    await user.type(bpm, '128')
    expect(bpm).toHaveValue(128)
    await user.tab()
    expect(bpm).toHaveValue(128)
  })

  test('a style button loads its pattern', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: 'Trap' }))
    expect(screen.getByLabelText('Tempo in beats per minute')).toHaveValue(140)
    expect(screen.getByLabelText('Sound')).toHaveValue('bell')
  })

  test('play starts the beat and stop ends it', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  test('the beat is remembered on the device', async () => {
    const user = userEvent.setup()
    const first = render(<Panel />)
    await user.click(screen.getByRole('button', { name: 'Trap' }))
    await user.click(screen.getByRole('button', { name: 'Kick step 2' }))
    first.unmount()

    render(<Panel />)
    expect(screen.getByLabelText('Tempo in beats per minute')).toHaveValue(140)
    expect(screen.getByRole('button', { name: 'Kick step 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('a corrupted save does not break the app', () => {
    localStorage.setItem('gala.beat.v1', '{not json')
    render(<Panel />)
    expect(kickCells()).toHaveLength(16)
  })

  test('export renders a WAV and downloads it', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: /export wav/i }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('audio/wav')
    expect(screen.getByRole('button', { name: /export wav/i })).toBeEnabled()
  })

  test('export explains itself when the browser cannot do it', async () => {
    vi.stubGlobal('OfflineAudioContext', undefined)
    vi.stubGlobal('webkitOfflineAudioContext', undefined)
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: /export wav/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not supported/)
  })

  test('stops cleanly when the panel closes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const view = render(<Panel />)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await screen.findByRole('button', { name: 'Stop' })
    await act(async () => view.unmount())
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
