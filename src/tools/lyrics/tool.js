import { defineTool } from '../registry.js'

export default defineTool({
  id: 'lyrics',
  name: 'Lyrics',
  icon: 'notebook',
  path: '/lyrics',
  stage: 5,
  order: 40,
  summary: 'Write verses and hooks, then sync them to the beat.',
  features: [
    'Sections for verse, hook and bridge',
    'Syllable and rhyme helpers',
    'Chord sheet alongside the words',
    'Lines synced to the timeline',
  ],
})
