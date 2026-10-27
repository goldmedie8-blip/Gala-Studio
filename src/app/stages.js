// The build roadmap, shown on Home while Gala is under construction.
// When a stage ships, change its status to 'done'. The first stage that is not done shows as 'next'.
export const STAGES = [
  { stage: 0, name: 'Foundation', summary: 'App shell, design system, offline support and tests', done: true },
  { stage: 1, name: 'Projects and storage', summary: 'Create, save, back up and restore projects on the device', done: false },
  { stage: 2, name: 'Audio engine', summary: 'Transport, multitrack timeline and mixer', done: false },
  { stage: 3, name: 'Recording', summary: 'Microphone and guitar capture with latency correction', done: false },
  { stage: 4, name: 'Beats and instruments', summary: 'Sequencer, drum pads, piano roll and sample library', done: false },
  { stage: 5, name: 'Lyrics and songwriting', summary: 'Lyrics editor, chords and rhyme helpers', done: false },
  { stage: 6, name: 'Mixing and mastering', summary: 'Effects, presets, loudness and export', done: false },
  { stage: 7, name: 'Accounts, sync and community', summary: 'Sign in, cloud backup, sharing and a feed', done: false },
  { stage: 8, name: 'Polish and Play Store', summary: 'Onboarding, accessibility, performance and store release', done: false },
]

export function stageStatus(stage) {
  if (stage.done) return 'done'
  const firstOpen = STAGES.find((s) => !s.done)
  return firstOpen?.stage === stage.stage ? 'next' : 'planned'
}
