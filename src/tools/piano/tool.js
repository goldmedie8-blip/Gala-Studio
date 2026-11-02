import { defineTool } from '../registry.js'

export default defineTool({
  id: 'piano',
  name: 'Piano',
  icon: 'piano',
  path: '/piano',
  stage: 4,
  order: 32,
  component: () => import('./Panel.jsx'),
  summary: 'Play a piano, record a melody over your beat and put it in your song.',
  features: [
    'Piano, electric keys and soft pad sounds',
    'Record over your beat with a count-in, loop and add layers',
    'Chords, key and scale helper, and tidy-up timing',
    'Save the part as a piano track in your song',
  ],
})
