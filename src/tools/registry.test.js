import { beforeEach, describe, expect, test } from 'vitest'
import { clearTools, defineTool, getTools, registerTool } from './registry.js'

const valid = {
  id: 'sample',
  name: 'Sample',
  icon: 'music',
  path: '/sample',
  stage: 4,
  order: 99,
  summary: 'A sample tool.',
}

describe('defineTool', () => {
  test('accepts a valid tool and defaults features to an empty list', () => {
    const tool = defineTool(valid)
    expect(tool.id).toBe('sample')
    expect(tool.features).toEqual([])
  })

  test('freezes the definition so tools cannot be mutated later', () => {
    const tool = defineTool(valid)
    expect(Object.isFrozen(tool)).toBe(true)
  })

  test('rejects missing fields and names them', () => {
    expect(() => defineTool({ id: 'x' })).toThrow(/missing "name"/)
  })

  test('rejects an icon that is not in the icon set', () => {
    expect(() => defineTool({ ...valid, icon: 'party-emoji' })).toThrow(/unknown icon/)
  })

  test('rejects bad ids and paths', () => {
    expect(() => defineTool({ ...valid, id: 'Bad Id' })).toThrow(/id must use/)
    expect(() => defineTool({ ...valid, path: 'sample' })).toThrow(/path must look like/)
  })

  test('rejects paths reserved by the app', () => {
    expect(() => defineTool({ ...valid, path: '/library' })).toThrow(/reserved/)
    expect(() => defineTool({ ...valid, path: '/profile' })).toThrow(/reserved/)
  })

  test('rejects a stage outside 0 to 8', () => {
    expect(() => defineTool({ ...valid, stage: 9 })).toThrow(/stage must be/)
    expect(() => defineTool({ ...valid, stage: 2.5 })).toThrow(/stage must be/)
  })

  test('rejects a component that is not a loader function', () => {
    expect(() => defineTool({ ...valid, component: 'Panel.jsx' })).toThrow(/component must be/)
  })
})

describe('registerTool', () => {
  beforeEach(() => clearTools())

  test('returns tools sorted by order', () => {
    registerTool({ ...valid, id: 'b', path: '/b', order: 20 })
    registerTool({ ...valid, id: 'a', path: '/a', order: 10 })
    expect(getTools().map((t) => t.id)).toEqual(['a', 'b'])
  })

  test('rejects a duplicate id', () => {
    registerTool(valid)
    expect(() => registerTool({ ...valid, path: '/other' })).toThrow(/Duplicate tool id/)
  })

  test('rejects a path already used by another tool', () => {
    registerTool(valid)
    expect(() => registerTool({ ...valid, id: 'other' })).toThrow(/already used by tool "sample"/)
  })
})
