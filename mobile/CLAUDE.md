# Chord Fiend: Modal Interchange Sketchpad (the phone app)

A single-file, touch-first web app for sketching chord progressions. Blocks are chords you edit visually. It does modal interchange, applied chords (secondary dominants, tritone substitutions, leading-tone), auto-generated drums and bass, and has a built-in Learn curriculum (55 lessons in 13 units). Plain JavaScript, no build step. Sound is Tone.js 14.8.49, bundled in `vendor/Tone.js`.

The owner can code but is not a professional developer. Explain technical problems in plain language, and say what you verified and what you assumed.

## Commands

Run these from `mobile/`.

- `npm test` runs every test in `test/`. Node only, nothing to install. Run it before and after any change to chord logic, spelling, voicing or lessons.
- `node test/run-all.js drops` runs only test files whose name contains "drops". Add `-v` for full output.
- `npm run sync-engine` copies the shared engine (`../engine/src/engine.js`) into `index.html`. Run it after any change to the engine; `test_engine_in_sync` fails until you do.
- To try the app, open `index.html` in a browser, or run `python3 -m http.server` here and open http://localhost:8000 to test the installable (PWA) version, offline cache included.

## Layout

- `index.html` is the whole app: CSS, markup, then one `<script>`. The script uses `var` and function declarations throughout; match that style. Search by name, not line number:
  - The chord engine sits at the top of the script between the `SHARED ENGINE START` and `SHARED ENGINE END` markers. It is generated from `../engine/src/engine.js`: never edit it here. Change the engine there, run `npm run sync-engine`, and run the engine's tests too (`sh ../engine/run_tests.sh`), because the Ableton device uses the same engine.
  - `STORE_KEY`, `save`, `probeStorage`: persistence (about 1365-1430)
  - `SYNTH_BUILDERS`: the instruments (about 1606)
  - `scheduleBassForBlock`, `playDrumStepAt`: drums and bass playback
  - `renderTimeline`, `snapEditorPanel`: the block timeline and the bottom editor drawer
  - `openSettings`, `applyStateToAudio`: settings and audio setup
  - `PROGRESSION_LIBRARY`, `BORROWED_CHORD_LIBRARY`, `CURRICULUM`, `switchToLearnHome`, `openLesson`: Learn (about 4494 to the end)
- `test/` has the Node tests, `run-all.js`, and `helpers/load-app.js`.
- `tools/sync-engine.js` writes the shared engine block.
- `manifest.webmanifest`, `sw.js` (offline cache), `icons/`, `vendor/Tone.js`: what makes it an installable app. When you add a file the app loads, add it to `FILES` in `sw.js` and to the copy step in `../.github/workflows/pages.yml`, and bump `VERSION` in `sw.js`.
- `../original/` is a frozen snapshot (app plus six tests) taken 2026-10-04. Do not edit it.

## How the model works

- `state` is the active project's data object. `projectsStore` holds all projects and is saved to localStorage under `modalSketchpadProjects`.
- A song is sections of blocks. A block has fields such as `degreeIndex`, `chordSource` ("diatonic", "applied" or "free"), `appliedTargetIndex`, `appliedFunction`, `freeRoot` (a step above the key root) and `freeQuality` (free chords), `extensionIndex`, `blockModeIndex`, and the Alter fields `third`, `aug` / `flat5`, `seventh`, `tension`. See `defaultBlock()`.
- **Chord model.** The category says where the root comes from (diatonic degree, borrowed Mode listed by result via `modeOptionLabels`, applied function, or a free step `freeRoot` 0-11 above the key root shown as ♭II/III/♯IV via `stepNumeral`). Shape (`fieldShape`, the engine's `SHAPE_ORDER`) and Sus pick the scale's tones. **Alter** (`appendAlterGroup`, collapsed unless the block is altered) lets any chord but the leading-tone dim7 change 3rd (`third`), 5th (`fifth`: b5/5/#5; older `aug`/`flat5` still work), 7th (`seventh`) and Tension (`tension`). It shows the chord's real values (a V7 shows Major, 5, ♭7); choosing the key's own value (the engine's `withoutAlter`) clears the change, and changed fields are accent-colored. The block's numeral shows any change (II7, V+7, vi(maj7)). Labels are always numerals (`blockLabel` in the engine). Plan, including the future reverse lookup and voicing editor (previous / current / next blocks side by side, tap to move focus): `../docs/chord-model-plan.md`. Read it before changing how chords are built.
- The engine never reads `state`, the DOM or audio. Functions that need the key, mode or bass settings take them as parameters, and the app passes them in: `getChordSymbol(chord, state.masterRootIndex)`, `appliedFunctionLabel(block, state.masterModeIndex)`, `activeBeatPattern(beatKey, state.customBeatPatterns)`, `bassOctaveShift(rootPitch, state.bassWrapLow)`, `computeBassPitchForBlock(block, chord, pattern, state.bassWrapLow)`.
- Block labels come from the engine's `blockLabel(block, root, mode)`: the numeral and formula large (V7, ♭VI, V7/ii), the chord name small. The Ableton device uses the same function, so change labels there, not in the app.
- The Learn checks (`blockSignature`, `plainDegreeSeq`, `findBorrowedChord`) treat a free chord as neither a degree nor a borrowed chord.
- **Lesson goals (Units 11-13).** A lesson can define `goal(blocks)`, returning `{name, reveal}` once the person has built what the lesson teaches (or `null`). `updateLessonReveal` uses it instead of looking for a named progression, which these lessons (chromatic color, extensions, voice leading) would never match. Goals use `lessonChord`, `lessonPcs`, `lessonHas` and `lessonLowest`. Voice-leading lessons turn the bass part off per block (`bassToneIndex: -1`), because the bass plays the chord's root and would hide the inversion.
- **Melody lessons (Unit 10, Reharmonization).** A lesson with a `melody` field (notes as `[start, length, semis]`: 16ths from the section start, half steps above the key root, 0 = middle C's octave) shows its section as one wide sideways-scrolling lane (`renderLane`): a piano roll whose scale-tone rows take the lightened color of the chord on that degree, the chord blocks in one strip below, and a playhead that follows the audio clock (`playheadFrame`). The melody is fixed and plays on its own voice (`melodySynth`, `scheduleMelodyPass`), chosen in Settings as Melody sound (`state.melodyInstrument`, any `SYNTH_BUILDERS` key, Electric Piano by default, 3 dB above its builder level, plus the Melody volume slider `state.melodyVolume`, applied live by `applyMelodyVolume`); the exercise is changing chords under it. The lesson text reports which melody notes sit in the selected chord (`describeMelodyFit`); a lesson completes when a changed chord holds the note that lands with it (`melodyLessonFound`). Only melody lessons use the lane; normal sections and other lessons keep the wrapped rows. `test_reharm_lessons` checks every claim in the Unit 10 text. Spec and next steps: `../docs/melody-editor-spec.md`.
- While a section plays, the selection follows the playhead until the person taps a block: that pins it (`playback.pinned`), with no sound, and the editor is no longer re-rendered as the playhead moves, so an open menu isn't closed mid-edit. Tapping empty timeline space unpins it. A pinned block stays selected after Stop. Editor changes during playback play no preview (`previewCurrentBlock` returns early); they're heard the first time the playhead reaches the block, because `scheduleBlockNotes` builds each block's notes just before it plays (`BLOCK_PREPARE_AHEAD`), not when the pass starts. Block timing (durations) is fixed per pass, so a duration change lands on the next pass.

## Things that have bitten before

1. **Learn mode borrows the real key.** `openLesson()` sets `state.masterRootIndex` and `masterModeIndex` for the lesson. `save()` therefore restores `preLearnMasterRootIndex` and `preLearnMasterModeIndex` before serializing, and reinstates the lesson values afterward. Without this, a reload during a lesson brought the user's song back in the wrong key. Do not simplify `save()`.
2. **Saved songs are not a constraint.** The owner said (2026-10-10) not to spend effort adapting existing saved songs: rearchitect freely. Existing guards (`reverbDefaultsMigrated`, `instrumentTrims` defaulting to an empty map, the `.unreadable-backup` copy) can stay but don't need extending.
3. **Note spelling.** `keyPrefersFlats(rootIndex, modeIndex)` decides sharps or flats; `pitchToNoteName(pitch, preferFlats)` applies it. Known limits: F♯/G♭ in a major mode spells as F♯, E♭ minor spells as D♯m, and there is no E♯ or B♯ (a diminished chord shows as "Fdim", not "E♯dim"). Pickers show both names via `noteChoiceLabel`, which only changes the label; option values are pitch numbers.
4. **Inversions are labeled by chord degree**, not 0-6. The dropdown uses `chord.toneLabels`. For 9th, 11th and 13th chords the bass tone is lifted until it is really below the chosen bass note.
5. **Drop voicings.** `applyDrops` sorts pitches first, so "second from the top" means by pitch height, not array position. `test_drops` checks 70,560 combinations against the textbook definition.
6. **Lesson text must be checked against the engine.** Past errors: saying the backdoor dominant resolves "down" (B♭ to C is up), and claiming every note of a diminished 7th moves by a half step. Lessons that ask the user to edit a block into a 7th chord need `extensionIndex: 2` pre-set in the lesson's `blocks()`, or following the instructions gives a triad (`test_extension_fix` guards this). Lessons set `masterMode`, and `openLesson()` forces the home mode.
7. **Touch handling.** Block segments call `setPointerCapture` on pointerdown; without it a scroll gesture can steal the release and leave a note stuck. `holdPitches()` also releases any stuck note before starting a new one. The drawer's drag-end uses the terminating event's own `clientY`. Timeline scroll is saved and restored when the drawer expands or collapses (`programmaticScrollGuard`).
8. **No zoom.** The viewport tag has `maximum-scale=1, user-scalable=no` (stops iPhone zooming into fields under 16px), every element defaults to `touch-action: manipulation` (stops double-tap zoom, which fired when double-tapping a section), and a `gesturestart` handler cancels pinch. Elements that need their own touch-action set it with a class rule, which wins over the default.
9. **Avoid typed inputs.** Typing on the phone is a chore and number fields trigger iPhone's focus zoom. Tempo is a dropdown in steps of 5 (`showTempo`, which adds an option for a saved off-step value); prefer a dropdown for any new numeric setting.
10. **Select option values must be strings that match what the code reads back.** The reverb length options are "3" and "5". The old "3.0" and "5.0" never matched `parseFloat`, so reopening Settings showed a blank.

## Testing approach

- Tests load the app's script body (`test/helpers/load-app.js`) into `new Function('document', 'localStorage', 'Tone', code + '\nreturn {...}')` with a mock DOM and a mock Tone. To test an internal function, add it to that returned object in the test.
- A test ends by printing `ALL PASSED` or `SOME FAILED`, and prints failures as lines starting `FAIL`. `run-all.js` reads those markers; the tests do not set an exit code themselves.
- Write expected values from music theory, independent of the code under test, never copied from its output.
- `test_engine_in_sync` checks that the engine block matches `../engine/src/engine.js`.
- `test_reharm_lessons` checks Unit 10's melodies and every chord-fit claim in its text.
- `test_units_11_13` checks that each Unit 11-13 goal is unmet at the start, met by following the lesson's own instructions, and that every note the text names is what the app plays.
- The other six tests: applied chords, spelling (`test_enharmonic2`), applied-chord labels, the lesson 7th-chord fix, inversion labels, and drop voicings. Earlier work also had tests for gestures, scrolling, the drawer, audio, persistence, instruments and the rest of the curriculum, but they were not recovered. Do not assume those areas are covered; add a test when you change them.

## Where it runs

GitHub Pages, published by `../.github/workflows/pages.yml` on every push to `main` that touches `mobile/`. The workflow runs `npm test` first and publishes nothing if a test fails. It is an installable PWA: on iPhone, open it in Safari, then Share, then Add to Home Screen. After that it works offline.

Updates: the service worker serves the cached copy first and fetches the new one in the background, so a change appears the second time the app is opened after a deploy.

Saved songs live in localStorage for the site's address. An app installed to the home screen on iPhone keeps its own storage, separate from Safari. Changing the address (a new repo name, a custom domain) starts with empty storage, so add project export and import before doing that.

The older Claude artifact copy (https://claude.ai/artifact/F6oZBUNT4tebBavXtTXN6V) is no longer updated.

## The other product in this repo

This repo also holds the Ableton Live device (`../device/`, plan in `../docs/build-plan.md`). The two products share only the chord engine in `../engine/`. A change there affects both, so run both test suites. The device's step 7 pastes projects in from this app, so treat the saved project format as shared too.

## Git

Work on a branch and push it. Changes reach `main` through a pull request, and merging to `main` publishes the app.
