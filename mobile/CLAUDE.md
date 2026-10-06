# Chord Fiend: Modal Interchange Sketchpad (the phone app)

A single-file, touch-first web app for sketching chord progressions. Blocks are chords you edit visually. It does modal interchange, applied chords (secondary dominants, tritone substitutions, leading-tone), auto-generated drums and bass, and has a built-in Learn curriculum (40 lessons in 9 units). Plain JavaScript, no build step. Sound is Tone.js 14.8.49 from cdnjs.

The owner can code but is not a professional developer. Explain technical problems in plain language, and say what you verified and what you assumed.

## Commands

- `npm test` runs every test in `test/`. Node only, nothing to install. Run it before and after any change to chord logic, spelling, voicing or lessons.
- `node test/run-all.js drops` runs only test files whose name contains "drops". Add `-v` for full output.
- To try the app, open `app/index.html` in a browser (needs network for Tone.js).

## Layout

- `app/index.html` is the whole app. Roughly: CSS lines 8-756, markup 758-956, one `<script>` from 957 to the end. The script uses `var` and function declarations throughout; match that style. Line numbers drift, so search by name:
  - `keyPrefersFlats`, `applyDrops`, `buildChord`, `noteChoiceLabel`, `getChordSymbol`: the chord engine (about 1015-1200)
  - `STORE_KEY`, `save`, `probeStorage`: persistence (about 1365-1430)
  - `SYNTH_BUILDERS`: the instruments (about 1606)
  - `BUILTIN_BEAT_PATTERNS`, `scheduleBassForBlock`: drums and bass (about 1989-2150)
  - `renderTimeline`, `snapEditorPanel`: the block timeline and the bottom editor drawer
  - `openSettings`, `applyStateToAudio`: settings and audio setup
  - `PROGRESSION_LIBRARY`, `BORROWED_CHORD_LIBRARY`, `CURRICULUM`, `switchToLearnHome`, `openLesson`: Learn (about 4494 to the end)
- `test/` has the Node tests, `run-all.js`, and `helpers/load-app.js`.
- `original/` is a frozen snapshot (app plus six tests) taken 2026-10-04 as a reference for the Ableton device rebuild. Do not edit it.

## How the model works

- `state` is the active project's data object. `projectsStore` holds all projects and is saved to localStorage under `modalSketchpadProjects`.
- A song is sections of blocks. A block has fields such as `degreeIndex`, `chordSource` ("diatonic" or "applied"), `appliedTargetIndex`, `appliedFunction`, `extensionIndex` and `blockModeIndex`. See `defaultBlock()` for the full list.
- `buildChord(block, masterRootIndex, masterModeIndex)` is pure. It reaches only `applyDrops`, `buildExtendedScale`, `chordToneLabel` and `chordToneRoles`, and touches no state, DOM or audio. Keep it that way: the Ableton device will reuse this engine, with key and mode passed in as parameters.
- A few engine-adjacent functions still read `state`: `getChordSymbol` (key, for sharp or flat spelling), `appliedFunctionLabel` (mode), and the bass helpers `bassOctaveShift` and `computeBassPitchForBlock`. Prefer passing values in over reading `state` when you touch them.

## Things that have bitten before

1. **Learn mode borrows the real key.** `openLesson()` sets `state.masterRootIndex` and `masterModeIndex` for the lesson. `save()` therefore restores `preLearnMasterRootIndex` and `preLearnMasterModeIndex` before serializing, and reinstates the lesson values afterward. Without this, a reload during a lesson brought the user's song back in the wrong key. Do not simplify `save()`.
2. **Saved songs live in users' browsers.** Never rename or drop a stored field without a migration. Existing examples: `reverbDefaultsMigrated`, and `instrumentTrims` defaulting to an empty map on old stores. Unreadable stored data is backed up to `STORE_KEY + ".unreadable-backup"` before it is overwritten.
3. **Note spelling.** `keyPrefersFlats(rootIndex, modeIndex)` decides sharps or flats; `pitchToNoteName(pitch, preferFlats)` applies it. Known limits: F♯/G♭ in a major mode spells as F♯, E♭ minor spells as D♯m, and there is no E♯ or B♯ (a diminished chord shows as "Fdim", not "E♯dim"). Pickers show both names via `noteChoiceLabel`, which only changes the label; option values are pitch numbers.
4. **Inversions are labeled by chord degree**, not 0-6. The dropdown uses `chord.toneLabels`. For 9th, 11th and 13th chords the bass tone is lifted until it is really below the chosen bass note.
5. **Drop voicings.** `applyDrops` sorts pitches first, so "second from the top" means by pitch height, not array position. `test_drops` checks 70,560 combinations against the textbook definition.
6. **Lesson text must be checked against the engine.** Past errors: saying the backdoor dominant resolves "down" (B♭ to C is up), and claiming every note of a diminished 7th moves by a half step. Lessons that ask the user to edit a block into a 7th chord need `extensionIndex: 2` pre-set in the lesson's `blocks()`, or following the instructions gives a triad (`test_extension_fix` guards this). Lessons set `masterMode`, and `openLesson()` forces the home mode.
7. **Touch handling.** Block segments call `setPointerCapture` on pointerdown; without it a scroll gesture can steal the release and leave a note stuck. `holdPitches()` also releases any stuck note before starting a new one. The drawer's drag-end uses the terminating event's own `clientY`. Timeline scroll is saved and restored when the drawer expands or collapses (`programmaticScrollGuard`).
8. **Select option values must be strings that match what the code reads back.** The reverb length options are "3" and "5". The old "3.0" and "5.0" never matched `parseFloat`, so reopening Settings showed a blank.

## Testing approach

- Tests load the app's script body (`test/helpers/load-app.js`) into `new Function('document', 'localStorage', 'Tone', code + '\nreturn {...}')` with a mock DOM and a mock Tone. To test an internal function, add it to that returned object in the test.
- A test ends by printing `ALL PASSED` or `SOME FAILED`, and prints failures as lines starting `FAIL`. `run-all.js` reads those markers; the tests do not set an exit code themselves.
- Write expected values from music theory, independent of the code under test, never copied from its output.
- Only six tests are in this repo: applied chords, spelling (`test_enharmonic2`), applied-chord labels, the lesson 7th-chord fix, inversion labels, and drop voicings. Earlier work also had tests for gestures, scrolling, the drawer, audio, persistence, instruments and the rest of the curriculum, but they were not recovered. Do not assume those areas are covered; add a test when you change them.

## Where it runs today

The app is published as a Claude artifact and used on an iPhone in Safari. It has no web manifest and no service worker, so it is not an installable PWA. Hosting for this repo is undecided. Moving to a different URL means a different origin, so the user's saved songs (localStorage) would not follow. Add a project export and import before changing where the app is served.

## What comes next

An Ableton Live device (Max for Live) that reuses this chord engine and block editor and writes the result into Arrangement clips. The plan is the "Block Editor for Ableton: Build Plan" doc. The step that affects this repo is extracting the engine into a shared package with key and mode as parameters, with these tests moving alongside it.

## Git

Work on a branch and push the branch. Ask before changing `main`.
