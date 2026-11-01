# Lyrics in your backups: three small edits to src/storage/backup.js

This zip has two files that replace MY OWN earlier ones (nothing of yours):
    src/storage/lyricsStore.js
    src/storage/lyricsStore.test.js
Copy them over the earlier versions, then make these three edits in backup.js.

## a) Add one import. Under   import { listTimelines, saveTimeline } from './timelines.js'   add:

    import { exportLyrics, importLyrics } from './lyricsStore.js'

## b) In buildBackup, in the manifest, add one line right after the   timelines: ...   line:

    lyrics: exportLyrics(projects.map((p) => p.id)),

So that part reads:

    timelines: timelines.filter((t) => projects.some((p) => p.id === t.projectId)),
    lyrics: exportLyrics(projects.map((p) => p.id)),
    takes: takes.map(({ id, name, ...

## c) In restoreBackup, two additions.

Under   const timelines = Array.isArray(manifest?.timelines) ? manifest.timelines : []   add:

    const lyrics = Array.isArray(manifest?.lyrics) ? manifest.lyrics : []

Then just BEFORE   return { projects: restored, takes: parts.length }   add:

    importLyrics(lyrics) // older backups have none, which is fine

The return line stays exactly as it is.

## Try it by hand
1. In Studio, make a song and write some lyrics in Lyrics.
2. Library: make a backup file.
3. Change the lyrics (or delete the song), then restore the backup file.
4. The lyrics are back as they were when you made the backup.

Older .gala backup files still restore: they simply have no lyrics in them.
Not included on purpose: the unsaved draft (it belongs to no song).
