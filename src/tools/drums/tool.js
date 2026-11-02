import { defineTool } from '../registry.js'

export default defineTool({
  id: 'drums',
  name: 'Drum pads',
  icon: 'drum',
  path: '/drums',
  stage: 4,
  order: 34,
  component: () => import('./Panel.jsx'),
  summary: 'Tap drum pads to play your own drums, record them in time and add them to your song.',
  features: [
    'Ten drum pads: kick, snare, clap, hi-hats, percussion and more',
    'Record with a count-in and layer more drums on each loop',
    'Hits snap to the beat, and you can fix any step by hand',
    'Save the drums as a track in your song',
  ],
})
