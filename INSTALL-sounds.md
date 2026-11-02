# "My sounds": use your own drum recordings

Nothing in this zip replaces a file of yours. Five files are brand new, and two of YOUR files need a few lines
pasted in (steps 3 and 4).

## 1. Check first, then copy

Run this from your project folder BEFORE copying. Every line should say "new". If any says EXISTS, stop and tell me.

    $files = "src/engine/drumKit.js","src/engine/drumKit.test.js","src/tools/beats/MySounds.jsx","src/tools/beats/mySounds.css","src/tools/beats/MySounds.test.jsx"
    foreach ($f in $files) { if (Test-Path $f) { "EXISTS  $f" } else { "new     $f" } }

Then unzip into the project root. `git status --short` should list only those five files.

## 2. New files
    src/engine/drumKit.js          + drumKit.test.js
    src/tools/beats/MySounds.jsx, mySounds.css, MySounds.test.jsx

## 3. Edit src/engine/playback.js  (two small pastes)

a) Under the last import line   import { DRUMS, SOUNDS, synthNote } from './voices.js'   add:

    import { getSample, playSample } from './drumKit.js'

b) Replace the whole playDrum function

    export function playDrum(ctx, dest, laneId, time) {
      DRUMS[laneId](ctx, dest, time)
    }

   with:

    export function playDrum(ctx, dest, laneId, time) {
      // Your own recording for this drum, if you chose one in My sounds. Otherwise the built-in sound.
      const mine = getSample(laneId)
      if (mine) playSample(ctx, dest, mine, time)
      else DRUMS[laneId](ctx, dest, time)
    }

## 4. Edit src/tools/beats/Panel.jsx  (two small pastes)

a) Add one import with the others at the top:

    import MySounds from './MySounds.jsx'

b) Find the start of the Notes card:

    <section className="card" aria-labelledby="melody-heading">

   and paste this line just ABOVE it:

    <MySounds />

## 5. Check
    npx vitest run src/engine src/tools/beats
    npm run dev

Then: open Record and record ONE short hit (an engoma, a clap, a shaker). Open Beats, open "My sounds",
pick that recording for a drum and press Play.
