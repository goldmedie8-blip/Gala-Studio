import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { defineTool } from '../tools/registry.js'
import ToolPage from './ToolPage.jsx'

const base = {
  id: 'demo',
  name: 'Demo',
  icon: 'music',
  path: '/demo',
  stage: 4,
  order: 1,
  summary: 'A demo tool.',
}

describe('ToolPage', () => {
  test('shows the planned features when a tool has no panel yet', () => {
    const tool = defineTool({ ...base, features: ['First feature', 'Second feature'] })
    render(<ToolPage tool={tool} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Demo' })).toBeInTheDocument()
    expect(screen.getByText('Arrives in Stage 4')).toBeInTheDocument()
    expect(screen.getByText('First feature')).toBeInTheDocument()
  })

  test('loads the real panel when a tool provides one', async () => {
    const tool = defineTool({
      ...base,
      component: () => Promise.resolve({ default: () => <p>Panel is live</p> }),
    })
    render(<ToolPage tool={tool} />)
    expect(await screen.findByText('Panel is live')).toBeInTheDocument()
    expect(screen.queryByText(/Arrives in Stage/)).not.toBeInTheDocument()
  })
})
