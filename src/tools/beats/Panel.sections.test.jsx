import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeAudioContext, FakeOfflineAudioContext } from '../../../tests/fakeAudio.js'
import { resetAudioContextForTests } from '../../engine/audioContext.js'
import Panel from './Panel.jsx'

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

const kick = (n) => screen.getByRole('button', { name: `Kick step ${n}` })
const bars = () => within(screen.getByRole('group', { name: 'Arrangement' })).getAllByRole('button')

describe('Beats: sections and arrangement', () => {
  test('offers many styles', () => {
    render(<Panel />)
    const styles = within(screen.getByRole('heading', { name: 'Start from a style' }).parentElement).getAllByRole('button')
    expect(styles.length).toBeGreaterThanOrEqual(12)
  })

  test('each section keeps its own drums', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: /^clear$/i }))
    await user.click(kick(1))
    expect(kick(4)).toHaveAttribute('aria-pressed', 'false')
    // section B is still the ready-made hook, untouched by clearing A
    await user.click(screen.getByRole('button', { name: 'Edit section B, Hook' }))
    expect(kick(4)).toHaveAttribute('aria-pressed', 'true')
    await user.click(kick(2))
    await user.click(screen.getByRole('button', { name: 'Edit section A, Groove' }))
    expect(kick(1)).toHaveAttribute('aria-pressed', 'true')
    expect(kick(2)).toHaveAttribute('aria-pressed', 'false')
    expect(kick(4)).toHaveAttribute('aria-pressed', 'false')
  })

  test('a section can be copied into the open one', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: /^clear$/i }))
    await user.click(kick(3))
    await user.click(screen.getByRole('button', { name: 'Edit section C, Break' }))
    await user.selectOptions(screen.getByLabelText('Copy a section into this one'), 'A Groove')
    expect(kick(3)).toHaveAttribute('aria-pressed', 'true')
  })

  test('pressing a bar cycles its section, and bars can be added and removed', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    const before = bars().length
    expect(bars()[0]).toHaveTextContent('A')
    await user.click(bars()[0])
    expect(bars()[0]).toHaveTextContent('B')
    await user.click(screen.getByRole('button', { name: 'Add bar' }))
    expect(bars()).toHaveLength(before + 1)
    await user.click(screen.getByRole('button', { name: 'Remove last bar' }))
    expect(bars()).toHaveLength(before)
  })

  test('the arrangement is remembered on the device', async () => {
    const user = userEvent.setup()
    const first = render(<Panel />)
    await user.click(bars()[1])
    first.unmount()
    render(<Panel />)
    expect(bars()[1]).toHaveTextContent('B')
  })

  test('the bass line has its own notes and sound', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(screen.getByRole('button', { name: 'Bass' }))
    const rows = screen.getAllByRole('group', { name: /^Bass note .* steps$/ })
    expect(rows.length).toBeGreaterThan(0)
    const cell = within(rows[0]).getAllByRole('button')[0]
    await user.click(cell)
    expect(cell).toHaveAttribute('aria-pressed', 'true')
    await user.selectOptions(screen.getByLabelText('Sound'), '808')
    expect(screen.getByLabelText('Sound')).toHaveValue('808')
    await user.click(screen.getByRole('button', { name: 'Melody' }))
    expect(screen.queryAllByRole('group', { name: /^Bass note/ })).toHaveLength(0)
    expect(screen.getByLabelText('Sound')).not.toHaveValue('808')
  })

  test('you can choose between looping one section and playing the whole song', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    const loop = screen.getByRole('button', { name: 'Loop section' })
    const song = screen.getByRole('button', { name: 'Whole song' })
    expect(loop).toHaveAttribute('aria-pressed', 'true')
    await user.click(song)
    expect(song).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
  })
})
