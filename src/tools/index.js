// Auto-discovers every src/tools/<name>/tool.js and registers it.
// To add a tool: create src/tools/<name>/tool.js that default-exports defineTool({...}).
// Nothing else in the app needs to change.
import { clearTools, getTool, getTools, registerTool } from './registry.js'

const modules = import.meta.glob('./*/tool.js', { eager: true })

// Clearing first keeps hot reload in dev from reporting duplicates.
clearTools()
for (const [file, mod] of Object.entries(modules)) {
  if (!mod.default) throw new Error(`${file} must export default defineTool({ ... })`)
  registerTool(mod.default)
}

export { getTool, getTools }
