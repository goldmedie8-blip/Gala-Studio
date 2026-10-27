import { defineTool } from '../registry.js'

export default defineTool({
  id: 'mixer',
  name: 'Mix and Master',
  icon: 'sliders',
  path: '/mixer',
  stage: 6,
  order: 50,
  summary: 'Polish your song and export it ready to share.',
  features: [
    'EQ, compression, reverb and delay',
    'Presets for vocals and guitar',
    'Loudness meter and master limiter',
    'Export WAV, MP3 and stems',
  ],
})
