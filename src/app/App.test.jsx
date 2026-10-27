import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import { getTools } from '../tools/index.js'
import App from './App.jsx'

const renderAt = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

afterEach(() => setOnline(true))

describe('app shell', () => {
  test('home shows the welcome and every studio tool', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Gala' })).toBeInTheDocument()
    for (const tool of getTools()) {
      expect(screen.getAllByRole('link', { name: new RegExp(tool.name) }).length).toBeGreaterThan(0)
    }
  })

  test('sidebar and phone bar both provide navigation', () => {
    renderAt('/')
    const sidebar = screen.getByRole('navigation', { name: 'Primary' })
    const phone = screen.getByRole('navigation', { name: 'Mobile' })
    expect(within(sidebar).getByRole('link', { name: 'Record' })).toHaveAttribute('href', '/record')
    expect(within(phone).getByRole('link', { name: 'Record' })).toHaveAttribute('href', '/record')
  })

  test('navigating opens the tool page and marks it active', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const sidebar = screen.getByRole('navigation', { name: 'Primary' })
    await user.click(within(sidebar).getByRole('link', { name: 'Beats' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Beats' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Beats' })).toHaveAttribute('aria-current', 'page')
  })

  test('library, profile and unknown routes render', () => {
    const library = renderAt('/library')
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument()
    library.unmount()

    const profile = renderAt('/profile')
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument()
    profile.unmount()

    renderAt('/nowhere')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })

  test('player controls stay disabled until the engine exists', () => {
    renderAt('/')
    const player = screen.getByRole('region', { name: 'Player' })
    expect(within(player).getByRole('button', { name: 'Play' })).toBeDisabled()
  })
})

describe('offline awareness', () => {
  test('status flips to Offline when the connection drops and back when it returns', () => {
    setOnline(true)
    renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent('Online')

    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toHaveTextContent('Offline')

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByRole('status')).toHaveTextContent('Online')
  })
})

describe('search', () => {
  test('finds a tool by name and opens it', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.type(screen.getByRole('searchbox', { name: 'Search Gala' }), 'lyr')
    const results = screen.getByRole('list', { name: 'Search results' })
    await user.click(within(results).getByRole('link', { name: 'Lyrics' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Lyrics' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument()
  })

  test('says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.type(screen.getByRole('searchbox', { name: 'Search Gala' }), 'zzzz')
    expect(screen.getByText('No matches')).toBeInTheDocument()
  })
})
