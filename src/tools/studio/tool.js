import { defineTool } from '../registry.js'

export default defineTool({
  id: 'studio',
  name: 'Studio',
  icon: 'layers',
  path: '/studio',
  stage: 2,
  order: 10,
  summary: 'Multitrack timeline with a mixer for every track.',
  features: [
    'Play, pause, loop, tempo and metronome',
    'Volume, pan, mute and solo per track',
    'Eight or more tracks in sync',
    'Projects saved on your device',
  ],
})
