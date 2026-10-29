# Gala Studio

An offline-first music studio for young producers and artists: record, write lyrics, make beats and mix a complete song, on a phone or a laptop, with or without internet.

## Run it

```bash
npm install        # also turns on the pre-commit test gate
npm run dev        # open the printed address (also reachable from a phone on the same Wi-Fi)
npm test           # run all tests once
npm run build      # production build with the offline service worker
npm run preview    # try the production build, including offline mode
```

To test offline: run `npm run build` then `npm run preview`, open the app once, then turn off Wi-Fi (or tick "Offline" in the browser DevTools Network tab) and reload. The app must still open.

## Trying the microphone

Browsers only allow the microphone on a secure connection.

- **On your laptop:** `npm run dev` and open `http://localhost:5173`. localhost counts as secure, so it just works.
- **On your phone, same Wi-Fi:** run `npm run dev:phone`, then open the `https://` address it prints (the Network line). The browser warns about the certificate because it is self-signed. Tap Advanced, then continue. After that the Record tool works.
- **For friends and real users:** deploy the `dist` folder (after `npm run build`) to any https host such as Netlify, Vercel or GitHub Pages.

Use headphones when recording over a beat, otherwise the speakers leak into the microphone.

## Rules for everyone working on Gala

1. `npm test` must be green before anything is merged. A git pre-commit hook enforces this on every commit.
2. Every new tool ships with tests.
3. Icons come from `src/design/icons.js` only. No emojis anywhere in the app.
4. Colours, spacing and radii come from `src/design/tokens.css`. No hard-coded colours in components.
5. `src/engine/` is shared infrastructure and changes rarely. Tools import from it and never edit it.

## Project layout

```
src/
  app/        shell: sidebar, top bar, player bar, bottom nav, routes
  design/     tokens, base styles, icons, shared components
  engine/     shared audio engine (one AudioContext, recording constraints)
  pages/      Home, Library, Profile, and the generic tool page
  tools/      one folder per studio tool, each with a tool.js
tests/        test setup (end-to-end tests arrive with Stage 1)
scripts/      icon generation and git hook setup
docs/         research notes
```

## Adding a tool (for friends joining)

1. Create `src/tools/<your-tool>/tool.js`:

```js
import { defineTool } from '../registry.js'

export default defineTool({
  id: 'my-tool',            // lowercase, dashes
  name: 'My Tool',
  icon: 'music',            // must exist in src/design/icons.js
  path: '/my-tool',
  stage: 4,                 // roadmap stage, 0 to 8
  order: 60,                // position in the sidebar, must be unique
  summary: 'One line about what it does.',
  features: ['Shown on the page until the real panel exists'],
  // component: () => import('./Panel.jsx'),   // add when the real tool is ready
})
```

2. Add `src/tools/<your-tool>/Panel.jsx` when the tool is ready, then uncomment `component`.
3. Run `npm test`. The registry tests check the contract (unique id, path and order, real icon, valid stage), so a broken tool fails loudly before it can hurt anyone else's work.

The sidebar, routes, search and home cards update automatically. You never edit the shell.

## Roadmap

| Stage | Focus |
| --- | --- |
| 0 | Foundation: shell, design system, offline support, tests (done) |
| 1 | Projects and storage on the device, backup and restore |
| 2 | Audio engine: transport, multitrack timeline, mixer |
| 3 | Recording with latency correction, takes and comping |
| 4 | Beats and instruments, sample library |
| 5 | Lyrics and songwriting |
| 6 | Mixing, mastering and export |
| 7 | Accounts, cloud sync and community |
| 8 | Polish and Play Store release |

See `docs/RESEARCH.md` for the competitor study and the free libraries and samples we can build on.
