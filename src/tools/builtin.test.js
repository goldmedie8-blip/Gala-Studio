// Guard rail for everyone adding tools: if a new tool.js breaks the contract,
// importing the registry throws and these tests fail before it can be merged.
import { describe, expect, test } from 'vitest'
import { getTool, getTools } from './index.js'

describe('built-in tools', () => {
  test('the core studio tools are registered', () => {
    const ids = getTools().map((t) => t.id)
    for (const id of ['studio', 'record', 'beats', 'lyrics', 'mixer']) {
      expect(ids).toContain(id)
    }
  })

  test('every tool has a unique id, path and order', () => {
    const tools = getTools()
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length)
    expect(new Set(tools.map((t) => t.path)).size).toBe(tools.length)
    expect(new Set(tools.map((t) => t.order)).size).toBe(tools.length)
  })

  test('every tool without a panel lists what it will do', () => {
    for (const tool of getTools()) {
      if (!tool.component) expect(tool.features.length).toBeGreaterThan(0)
    }
  })

  test('getTool finds a tool by id', () => {
    expect(getTool('record').path).toBe('/record')
    expect(getTool('missing')).toBeUndefined()
  })
})
