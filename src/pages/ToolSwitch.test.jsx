import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import App from '../app/App.jsx'

// Moving from one tool straight to another (Piano to Timeline, a "save then open" link) must show the new tool.
describe('moving between tools', () => {
  test('Piano to Timeline to Drum pads and back', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/piano']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Piano' })).toBeInTheDocument()
    await screen.findByRole('button', { name: /add to my song/i })
    for (const name of ['Timeline', 'Drum pads', 'Piano']) {
      await user.click(screen.getAllByRole('link', { name })[0])
      expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
    }
  })
})
