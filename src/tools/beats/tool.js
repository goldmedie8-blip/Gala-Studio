import { defineTool } from '../registry.js'

export default defineTool({
  id: 'beats',
  name: 'Beats',
  icon: 'drum',
  path: '/beats',
  stage: 4,
  order: 30,
  component: () => import('./Panel.jsx'),
  summary: 'Drum pads, step sequencer and instruments that match your song.',
  features: [
    'Step sequencer and tap-in drum pads',
    'Piano roll with synth, bass, keys and guitar sounds',
    'Offline sample library',
    'Tempo and key matching',
  ],
})
