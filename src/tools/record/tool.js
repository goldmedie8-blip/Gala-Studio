import { defineTool } from '../registry.js'

export default defineTool({
  id: 'record',
  name: 'Record',
  icon: 'mic',
  path: '/record',
  stage: 3,
  order: 20,
  summary: 'Capture vocals and guitar with clean input and latency correction.',
  features: [
    'Choose your microphone or audio interface',
    'Live level meter and count-in',
    'Multiple takes with comping',
    'Raw, unprocessed input for guitar and vocals',
  ],
})
