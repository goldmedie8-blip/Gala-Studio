import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../../tests/fakeAudio.js'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import { saveTake } from '../../storage/takes.js'
import { BEAT_STORAGE_KEY } from '../../storage/beatStore.js'
import { PRESETS } from '../beats/presets.js'
import Panel from './Panel.jsx'

const renderPanel = () =>
  render(
    <MemoryRouter>
      <Panel />
    </MemoryRouter>,
  )

async function seed(...names) {
  for (const name of names) {
    await saveTake({ blob: new Blob(['voice'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 2000, name })
    await new Promise((r) => setTimeout(r, 5)) // so the newest take is clearly the newest
  }
}

const play = () => screen.getByRole('button', { name: 'Play' })
const ready = () => waitFor(() => expect(play()).toBeEnabled())

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
  URL.createObjectURL = vi.fn(() => 'blob:song')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  resetAudioContextForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Studio without a voice', () => {
  test('points to Record and offers to add a file', async () => {
    renderPanel()
    expect(await screen.findByRole('heading', { name: 'No voice yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /record a voice/i })).toHaveAttribute('href', '/record')
    expect(screen.getByLabelText('Add audio file')).toBeInTheDocument()
    expect(play()).toBeDisabled()
    expect(screen.getByRole('button', { name: /export song/i })).toBeDisabled()
  })

  test('adding an audio file saves it as a voice and selects it', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('heading', { name: 'No voice yet' })
    await user.upload(screen.getByLabelText('Add audio file'), new File(['abc'], 'My song.mp3', { type: 'audio/mpeg' }))
    const option = await screen.findByRole('radio', { name: /My song/ })
    expect(option).toBeChecked()
    await ready()
  })

  test('says so when a file is not audio', async () => {
    class CannotDecode extends FakeAudioContext {
      constructor() {
        super()
        this.decodeAudioData = vi.fn(async () => {
          throw new Error('bad data')
        })
      }
    }
    vi.stubGlobal('AudioContext', CannotDecode)
    const user = userEvent.setup({ applyAccept: false }) // the picker's filter is only a hint, people can pick any file
    renderPanel()
    await screen.findByRole('heading', { name: 'No voice yet' })
    await user.upload(screen.getByLabelText('Add audio file'), new File(['abc'], 'notes.txt', { type: 'text/plain' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be opened as audio/)
  })
})

describe('Studio with recorded voices', () => {
  test('lists the voices, selects the newest and draws its waveform', async () => {
    await seed('Take 1', 'Take 2')
    renderPanel()
    expect(await screen.findByRole('radio', { name: /Take 2/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Take 1/ })).not.toBeChecked()
    expect(await screen.findByRole('img', { name: /Voice waveform/ })).toBeInTheDocument()
    await ready()
  })

  test('choosing another voice switches to it', async () => {
    const user = userEvent.setup()
    await seed('Take 1', 'Take 2')
    renderPanel()
    await ready()
    await user.click(screen.getByRole('radio', { name: /Take 1/ }))
    expect(screen.getByRole('radio', { name: /Take 1/ })).toBeChecked()
    await ready()
  })

  test('a recording that cannot be decoded shows a message instead of breaking', async () => {
    class CannotDecode extends FakeAudioContext {
      constructor() {
        super()
        this.decodeAudioData = vi.fn(async () => {
          throw new Error('bad data')
        })
      }
    }
    vi.stubGlobal('AudioContext', CannotDecode)
    await seed('Take 1')
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be opened/)
    expect(play()).toBeDisabled()
  })

  test('play starts voice and beat together and stop ends them', async () => {
    const user = userEvent.setup()
    await seed('Take 1')
    renderPanel()
    await ready()
    await user.click(play())
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  test('shows the timeline length next to the clock', async () => {
    await seed('Take 1')
    renderPanel()
    await ready()
    expect(screen.getByText('0:00 / 0:02')).toBeInTheDocument()
  })
})

describe('lining the beat up with the voice', () => {
  test('nudge buttons move the beat start in hundredths of a second', async () => {
    const user = userEvent.setup()
    await seed('Take 1')
    renderPanel()
    await ready()
    expect(screen.getByText('0.00 s')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Beat later' }))
    expect(screen.getByText('+0.01 s')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Beat earlier' }))
    await user.click(screen.getByRole('button', { name: 'Beat earlier' }))
    expect(screen.getByText('-0.01 s')).toBeInTheDocument()
  })

  test('the slider sets the beat start, including before the voice', async () => {
    await seed('Take 1')
    renderPanel()
    await ready()
    const slider = screen.getByLabelText('Beat starts')
    fireEvent.change(slider, { target: { value: '1.5' } })
    expect(screen.getByText('+1.50 s')).toBeInTheDocument()
    fireEvent.change(slider, { target: { value: '-1' } })
    expect(screen.getByText('-1.00 s')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /beats? starts -1.00 s/i })).toBeInTheDocument()
  })

  test('choosing a different voice resets the beat start', async () => {
    const user = userEvent.setup()
    await seed('Take 1', 'Take 2')
    renderPanel()
    await ready()
    fireEvent.change(screen.getByLabelText('Beat starts'), { target: { value: '2' } })
    expect(screen.getByText('+2.00 s')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Take 1/ }))
    await screen.findByText('0.00 s')
  })

  test('tap tempo works out the speed from your taps', async () => {
    await seed('Take 1')
    renderPanel()
    await ready()
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const tap = screen.getByRole('button', { name: /tap tempo/i })
    for (const t of [0, 500, 1000, 1500]) {
      now = t
      fireEvent.click(tap)
    }
    expect(screen.getByLabelText('Tempo in beats per minute')).toHaveValue(120)
  })

  test('half and double change the tempo and stay in range', async () => {
    const user = userEvent.setup()
    await seed('Take 1')
    renderPanel()
    await ready()
    const bpm = screen.getByLabelText('Tempo in beats per minute')
    await user.clear(bpm)
    await user.type(bpm, '120')
    await user.click(screen.getByRole('button', { name: 'Half' }))
    expect(bpm).toHaveValue(60)
    await user.click(screen.getByRole('button', { name: 'Half' }))
    expect(bpm).toHaveValue(60)
    await user.click(screen.getByRole('button', { name: 'Double' }))
    expect(bpm).toHaveValue(120)
  })

  test('tempo buttons and styles update the beat', async () => {
    const user = userEvent.setup()
    await seed('Take 1')
    renderPanel()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Trap' }))
    const bpm = screen.getByLabelText('Tempo in beats per minute')
    expect(bpm).toHaveValue(140)
    await user.click(screen.getByRole('button', { name: 'Faster' }))
    expect(bpm).toHaveValue(141)
    await user.selectOptions(screen.getByLabelText('Key'), 'F#')
    expect(screen.getByLabelText('Key')).toHaveValue('6')
  })

  test('voice and beat volumes can be balanced', async () => {
    await seed('Take 1')
    renderPanel()
    await ready()
    expect(screen.getByLabelText('Voice 100%')).toBeInTheDocument()
    expect(screen.getByLabelText('Beat 60%')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Voice 100%'), { target: { value: '0.5' } })
    fireEvent.change(screen.getByLabelText('Beat 60%'), { target: { value: '1.2' } })
    expect(screen.getByLabelText('Voice 50%')).toBeInTheDocument()
    expect(screen.getByLabelText('Beat 120%')).toBeInTheDocument()
  })
})

describe('the beat is shared with the Beats tool', () => {
  test('opens the beat saved by Beats', async () => {
    const trap = PRESETS.find((p) => p.id === 'trap').pattern
    localStorage.setItem(BEAT_STORAGE_KEY, JSON.stringify(trap))
    await seed('Take 1')
    renderPanel()
    await ready()
    expect(screen.getByLabelText('Tempo in beats per minute')).toHaveValue(140)
  })

  test('tempo changes made here are saved for Beats to see', async () => {
    const user = userEvent.setup()
    await seed('Take 1')
    renderPanel()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Faster' }))
    const saved = JSON.parse(localStorage.getItem(BEAT_STORAGE_KEY))
    expect(saved.bpm).toBe(PRESETS[0].pattern.bpm + 1)
  })

  test('links to the Beats tool for detailed editing', async () => {
    await seed('Take 1')
    renderPanel()
    await ready()
    expect(screen.getByRole('link', { name: /edit this beat/i })).toHaveAttribute('href', '/beats')
  })
})

describe('export', () => {
  test('mixes voice and beat into one WAV and downloads it', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await seed('Take 1')
    renderPanel()
    await ready()
    await user.click(screen.getByRole('button', { name: /export song/i }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('audio/wav')
    expect(screen.getByRole('button', { name: /export song/i })).toBeEnabled()
  })

  test('explains when the browser cannot export', async () => {
    vi.stubGlobal('OfflineAudioContext', undefined)
    vi.stubGlobal('webkitOfflineAudioContext', undefined)
    const user = userEvent.setup()
    await seed('Take 1')
    renderPanel()
    await ready()
    await user.click(screen.getByRole('button', { name: /export song/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not supported/)
  })
})

describe('cleanup', () => {
  test('leaving the screen while playing stops everything', async () => {
    await seed('Take 1')
    const view = renderPanel()
    await ready()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(play())
    await screen.findByRole('button', { name: 'Stop' })
    await act(async () => view.unmount())
    expect(vi.getTimerCount()).toBe(0)
  })
})
