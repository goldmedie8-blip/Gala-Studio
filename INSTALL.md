# Lyrics inside Studio: install guide

Nothing in this zip replaces a file of yours. Eight files are brand new, and four are my own Lyrics files
from the earlier zip (updated). Two of YOUR files need a few lines pasted in (steps 3 and 4).

## 1. Check first, then copy

Run this from your project folder BEFORE copying anything. "new" means the name is free.
The four Lyrics files should say EXISTS (they are mine from before). Anything else saying EXISTS: stop and tell me.

    $files = "src/storage/lyricsStore.js","src/storage/lyricsStore.test.js","src/engine/followLyrics.js","src/engine/followLyrics.test.js","src/tools/studio/StudioLyrics.jsx","src/tools/studio/studioLyrics.css","src/tools/studio/StudioLyrics.test.jsx","src/tools/lyrics/useLyrics.js","src/tools/lyrics/Panel.jsx","src/tools/lyrics/lyrics.css","src/tools/lyrics/Panel.test.jsx"
    foreach ($f in $files) { if (Test-Path $f) { "EXISTS  $f" } else { "new     $f" } }

Then unzip into the project root. Afterwards `git status --short` should list ONLY the files above.

## 2. New files (nothing of yours is touched)
    src/storage/lyricsStore.js      + lyricsStore.test.js
    src/engine/followLyrics.js      + followLyrics.test.js
    src/tools/studio/StudioLyrics.jsx, studioLyrics.css, StudioLyrics.test.jsx

## 3. Edit src/tools/studio/Screen.jsx  (two small pastes)

a) Under the line   import { useVoiceBeat } from './useVoiceBeat.js'   add:

    import StudioLyrics from './StudioLyrics.jsx'

b) Find this line (the start of the "Record over the beat" card):

    <section className="card" aria-labelledby="over-heading">

   and paste this block just ABOVE it:

    <StudioLyrics
      projectId={song.project?.id ?? null}
      bpm={pattern.bpm}
      beatTime={studio.position - planStart(studio.offset).beatDelay}
      playing={studio.playing}
    />

## 4. Edit src/storage/projects.js  (three small pastes)

a) Under   import { deleteTimeline } from './timelines.js'   add:

    import { copyLyrics, deleteLyrics } from './lyricsStore.js'

b) In deleteProject, under the line that starts   await deleteTimeline(id)...   add:

    deleteLyrics(id) // its lyrics go with it

c) In duplicateProject, replace the last line

    return createProject({ ...project, name: `${project.name.slice(0, 74)} copy` })

   with these three lines:

    const copy = await createProject({ ...project, name: `${project.name.slice(0, 74)} copy` })
    copyLyrics(id, copy.id)
    return copy

## 5. Check
    npm test
Expect every file to pass. Then `npm run dev`: open Studio, write lyrics in Lyrics, come back, press Play.
