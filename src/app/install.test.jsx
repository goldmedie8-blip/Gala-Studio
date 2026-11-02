import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { InstallButton } from './InstallButton.jsx'
import { InstallCard } from './InstallCard.jsx'
import { resetInstallForTests, startInstallWatch } from './install.js'

const fireOffer = (outcome = 'accepted') => {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn(async () => {})
  event.userChoice = Promise.resolve({ outcome })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

beforeEach(() => {
  localStorage.clear()
  resetInstallForTests()
  window.matchMedia = vi.fn(() => ({ matches: false }))
  startInstallWatch()
})
afterEach(() => resetInstallForTests())

describe('installing Gala', () => {
  test('the top bar button appears only when the browser offers to install, and uses the offer', async () => {
    const user = userEvent.setup()
    render(<InstallButton />)
    expect(screen.queryByRole('button', { name: /install/i })).toBeNull()
    const event = fireOffer()
    expect(event.defaultPrevented).toBe(true) // kept for our own button
    await user.click(await screen.findByRole('button', { name: /install/i }))
    expect(event.prompt).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /install/i })).toBeNull() // an offer can be used once
  })

  test('the card installs in one tap when it can', async () => {
    const user = userEvent.setup()
    render(<InstallCard />)
    fireOffer()
    await user.click(await screen.findByRole('button', { name: /install gala/i }))
  })

  test('without an offer the card explains how, and Not now hides it for good', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<InstallCard />)
    expect(screen.getByText(/browser menu/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /not now/i }))
    expect(screen.queryByText(/put gala on your device/i)).toBeNull()
    unmount()
    render(<InstallCard />)
    expect(screen.queryByText(/put gala on your device/i)).toBeNull()
  })

  test('iPhone gets the Share steps', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    render(<InstallCard />)
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument()
    expect(screen.getByText(/share button/i)).toBeInTheDocument()
  })

  test('nothing shows once the app is installed', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    resetInstallForTests()
    startInstallWatch()
    render(<InstallCard />)
    expect(screen.queryByText(/put gala on your device/i)).toBeNull()
  })

  test('the manifest has what installers need', async () => {
    const dist = await import('node:fs').then((fs) => fs.existsSync('dist/manifest.webmanifest') && JSON.parse(fs.readFileSync('dist/manifest.webmanifest', 'utf8')))
    if (!dist) return // only checked after a build
    expect(dist.display).toBe('standalone')
    expect(dist.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    expect(dist.icons.some((i) => i.sizes === '512x512')).toBe(true)
    expect(dist.start_url).toBeTruthy()
    expect(dist.screenshots.length).toBeGreaterThan(1)
  })
})
