# chord-fiend

Modal Interchange Sketchpad: a phone-first web app for sketching chord progressions. Blocks are chords you can edit visually; it knows modal interchange and applied chords, generates drums and bass, and has a built-in Learn curriculum. One HTML file, plain JavaScript, no build step. Sound comes from Tone.js loaded from a CDN.

## Try it

Open `app/index.html` in a browser (it needs network access for Tone.js).

## Test

    npm test

Needs Node only; there is nothing to install. See `CLAUDE.md` for how the tests work and what to watch for when changing the app.

## Layout

- `app/index.html`: the whole app.
- `test/`: Node tests for the chord engine and spelling, plus `run-all.js` and `helpers/load-app.js`.
- `original/`: frozen snapshot of the app and six tests taken 2026-10-04, kept as a reference. Do not edit.
