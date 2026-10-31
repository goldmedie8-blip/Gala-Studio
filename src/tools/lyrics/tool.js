import { defineTool } from '../registry.js'

export default defineTool({
  id: 'lyrics',
  name: 'Lyrics',
  icon: 'notebook',
  path: '/lyrics',
  stage: 5,
  order: 40,
  component: () => import('./Panel.jsx'),
  summary: 'Write verses and hooks with syllable counts and rhyme help.',
  features: [
    'Sections for intro, verse, hook, bridge and outro',
    'Syllable count and rhyme letter on every line',
    'Rhyme finder for English, Luganda and Swahili',
    'Chords alongside the words',
    'Export as a text file',
  ],
})
