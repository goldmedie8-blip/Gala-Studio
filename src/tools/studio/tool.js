import { defineTool } from '../registry.js'

export default defineTool({
  id: 'studio',
  name: 'Studio',
  icon: 'layers',
  path: '/studio',
  stage: 2,
  order: 10,
  component: () => import('./Panel.jsx'),
  summary: 'Put a beat under your recorded voice and line them up.',
  features: [
    'Play, pause, loop, tempo and metronome',
    'Volume, pan, mute and solo per track',
    'Eight or more tracks in sync',
    'Projects saved on your device',
  ],
})
