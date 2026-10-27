# Gala research notes (October 2026)

## 1. What exists today

| App | What it does well | Gap Gala can fill |
| --- | --- | --- |
| BandLab | Free browser and mobile studio, large community, royalty-free loop library, cloud projects, mobile app records and edits offline | Cloud features need internet, and the browser version depends on connection and CPU. Not built around African genres or low-end phones. |
| Soundtrap | Polished, strong in schools and podcasts, real-time collaboration | Free tier is limited, so young producers hit a wall quickly. |
| Audiotool | Uncapped free studio with modular cable routing | The studio needs a desktop browser, so it is not usable on a phone. |
| Amped Studio | Works as an offline-capable PWA | Much of its content is behind a paywall (claim from a competitor's comparison page, verify before relying on it). |
| Efflux | A PWA that makes music in the browser online or offline, phone to desktop | Tracker style, not guided songwriting. |
| Chrome Music Lab | Simple interactive experiments that teach rhythm and melody | Not a studio. Good source of ideas for onboarding. |

Takeaway: nobody combines a full song workflow (record, beats, lyrics, mix) with offline-first design for phones, in a form that teaches as it goes. That is Gala's position.

## 2. Uganda context

- Android dominates. The most downloaded apps in Uganda include the Lite versions of big apps, because people avoid spending data on heavy downloads, and phones are mostly Tecno, Infinix and itel.
- In the music category, three DJ apps are in the top ten, plus Boomplay and MP3 downloaders. There is real demand for making and playing music on phones.
- Data is improving but still a real cost: roughly Shs2,000 per GB and average monthly data spend above Shs10,000 as of September 2025. Smartphone connections reached about 19 million by 2025.
- Design consequences: offline first, small download, fast on low-end Android, no features that require a connection to be useful.

## 3. Free building blocks

| Need | Choice | Notes |
| --- | --- | --- |
| Audio engine | Web Audio API plus Tone.js | Tone.js gives a global Transport for scheduling, prebuilt synths and effects, and works on desktop and mobile browsers. Install with npm so it is bundled and works offline. |
| Recording | MediaRecorder plus getUserMedia | Turn off echoCancellation, noiseSuppression and autoGainControl. Measured round-trip latency dropped from about 67 ms to about 19 ms in Chrome with these settings (see section 4). Already encoded in `src/engine/constraints.js`. |
| Drum samples | oramics/sampled collection, TR-707 samples, AVL Drumkits | Each kit has its own license. AVL Drumkits are CC-BY-SA 3.0, and per the author attribution is only needed if you modify the samples or formats. Check each pack before shipping. |
| General instruments | GeneralUser GS SoundFont | License allows free use in music and software projects. Good base for piano, bass, guitar and strings once we add a SoundFont player. |
| Reverb | Free impulse responses (EMT-140 plate, Voxengo IRs) in the sampled collection | Check each license. |
| Local sound | Record our own Ugandan percussion and instruments | Best long-term edge: a sample pack no foreign app has. Also removes license risk. |

Rule: every sample we ship is stored locally in the app (never fetched from a CDN at play time) so it works offline, and its license is recorded in `docs/LICENSES.md` when Stage 4 begins.

## 4. Browser limits to plan around

- Recording latency is the hardest problem. With default settings Chrome measured about 67 ms and Firefox about 55 ms end to end. With processing turned off and low-latency hints, about 19 ms in Chrome and 14 ms in Firefox. Chrome latency was not perfectly constant, so Stage 3 includes a latency calibration step and compensation.
- Audio stays suspended until the person taps something, so the first tap must call `unlockAudio()` from `src/engine/audioContext.js`.
- Safari and iOS behave differently from Chrome. Android Chrome is the primary target, iOS is tested but secondary.

## Sources

- https://techjockey.com/detail/bandlab
- https://symposium.music.org/index.php/61-1/item/11510-bandlab-a-free-cloud-based-digital-audio-workstation-daw-for-music-production
- https://www.audiotool.com/compare
- https://www.audiotool.com/compare/audiotool-vs-bandlab
- https://alternativeto.net/software/soundtrap/?p=2
- https://github.com/Tonejs/Tone.js
- https://github.com/oramics/sampled
- https://www.bandshed.net/avldrumkits/
- https://scancode-licensedb.aboutcode.org/generaluser-gs-2.0.yml
- https://www.lesswrong.com/posts/ooXEzrX7Y9Go6D7st/browser-audio-latency
- https://digestafrica.com/what-are-the-most-downloaded-apps-in-uganda-and-what-insights-do-they-reveal
- https://www.monitor.co.ug/uganda/business/technology/why-uganda-is-offline-5376622
- https://www.monitor.co.ug/uganda/business/prosper/the-opportunity-in-cheaper-internet-5384884
