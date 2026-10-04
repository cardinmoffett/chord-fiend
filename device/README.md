# device/ : the Chord Fiend Max for Live device

An [m4l-jweb](https://github.com/alienmind/m4l-jweb) 1.6.1 project. For now it builds one device, **chord-fiend-test**, for the feel tests in step 3 of the build plan. How to use it in Live is in [`../feel-test/README.md`](../feel-test/README.md).

```bash
pnpm install
pnpm build    # dist/chord-fiend-test/chord-fiend-test.amxd - no Max needed
pnpm test     # the Live-side logic against a fake Live set (needs a build first)
```

## What is where

| File | What it is |
|---|---|
| `src/app/chord-fiend-test/Editor.tsx` | The editor window, where the feel test happens. |
| `src/app/chord-fiend-test/App.tsx` | The device strip on the track (169 px tall): opens the editor. |
| `src/app/chord-fiend-test/surface.ts` | The window and the saved song (`state`), and the starting song. |
| `src/app/chord-fiend-test/protocol.ts` | Every message between the pages and Max. |
| `wrapper/device.ts` | The Live side: track list, writing Arrangement clips, the transport. Must compile to ES5. |
| `patcher/devices.mjs` | The device manifest: a MIDI effect with no chains, so MIDI passes through. |
| `patches/@m4l-jweb__wrapper@1.6.1.patch` | Our two Mac fixes to the library: the page address, and retrying a page that did not load. |
| `tests/wrapper-live.test.mjs` | Runs the built wrapper against a fake Max and Live. |

The chord engine comes from `../engine/src/` (`engine.js` and `notes.js`).
