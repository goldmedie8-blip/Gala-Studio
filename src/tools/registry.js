// The tool contract. Every studio tool (recorder, beat maker, lyrics, and anything a friend adds)
// describes itself with defineTool(). The app builds its sidebar, routes, search and home cards
// from this registry, so adding a tool never means editing the shell.
import { hasIcon } from '../design/icons.js'

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const PATH_PATTERN = /^\/[a-z0-9-]+$/
const RESERVED_PATHS = ['/library', '/profile']
const REQUIRED = ['id', 'name', 'icon', 'path', 'stage', 'order', 'summary']

const tools = new Map()

export function defineTool(def) {
  const errors = []

  for (const key of REQUIRED) {
    if (def?.[key] === undefined || def[key] === '') errors.push(`missing "${key}"`)
  }
  if (def?.id && !ID_PATTERN.test(def.id)) errors.push('id must use lowercase letters, numbers and dashes')
  if (def?.icon && !hasIcon(def.icon)) errors.push(`unknown icon "${def.icon}" (add it to src/design/icons.js)`)
  if (def?.path && !PATH_PATTERN.test(def.path)) errors.push('path must look like "/my-tool"')
  if (def?.path && RESERVED_PATHS.includes(def.path)) errors.push(`path "${def.path}" is reserved by the app`)
  if (def?.stage !== undefined && !(Number.isInteger(def.stage) && def.stage >= 0 && def.stage <= 8)) {
    errors.push('stage must be a whole number from 0 to 8')
  }
  if (def?.order !== undefined && typeof def.order !== 'number') errors.push('order must be a number')
  if (def?.component !== undefined && typeof def.component !== 'function') {
    errors.push('component must be a function that returns import("./Panel.jsx")')
  }
  if (def?.features !== undefined && !Array.isArray(def.features)) errors.push('features must be an array of strings')

  if (errors.length > 0) {
    throw new Error(`Invalid tool "${def?.id ?? 'unknown'}": ${errors.join('; ')}`)
  }
  return Object.freeze({ features: [], ...def })
}

export function registerTool(def) {
  const tool = defineTool(def)
  if (tools.has(tool.id)) throw new Error(`Duplicate tool id "${tool.id}"`)
  for (const existing of tools.values()) {
    if (existing.path === tool.path) {
      throw new Error(`Path "${tool.path}" is already used by tool "${existing.id}"`)
    }
  }
  tools.set(tool.id, tool)
  return tool
}

export const getTools = () => [...tools.values()].sort((a, b) => a.order - b.order)
export const getTool = (id) => tools.get(id)
export const clearTools = () => tools.clear()
