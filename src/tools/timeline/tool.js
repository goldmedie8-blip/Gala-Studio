import { defineTool } from '../registry.js'

export default defineTool({
  id: 'timeline',
  name: 'Timeline',
  icon: 'list',
  path: '/timeline',
  stage: 2,
  order: 15,
  component: () => import('./Panel.jsx'),
  summary: 'Arrange recordings and beats on tracks, mix them and export the song.',
  features: [
    'Play, pause, loop, tempo and metronome',
    'Move, trim, split and duplicate clips',
    'Volume, pan, mute, solo, EQ and reverb per track',
    'Level meters and WAV export',
  ],
})
