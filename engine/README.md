# engine/ : the Chord Fiend chord engine

Plain JavaScript with no dependencies. It builds chords from blocks, names and spells them, handles inversions and drop voicings, and works out bass pitches from the drum and bass patterns. It does not touch the screen, sound, storage or timers, so the same file can run in the Max for Live device's window, in the mobile app, or in Node.

## Where it came from

`src/engine.js` is used by both products: the Ableton device imports it, and the phone app carries a copy of it in `mobile/index.html` (refreshed with `npm run sync-engine` in `mobile/`). It was copied line for line from `original/modal-sketchpad.html`. The only changes are the five functions that used to read the app's global `state`. They now take those settings as parameters:

| Function | New parameter | Was |
| --- | --- | --- |
| `getChordSymbol(chord, masterRootIndex)` | home key | `state.masterRootIndex` |
| `appliedFunctionLabel(block, masterModeIndex)` | home mode | `state.masterModeIndex` |
| `bassOctaveShift(rootPitch, bassWrapLow)` | bass lowest note | `state.bassWrapLow` |
| `activeBeatPattern(beatKey, customBeatPatterns)` | the project's edited beats | `state.customBeatPatterns` |
| `computeBassPitchForBlock(block, chord, pattern, bassWrapLow)` | the beat in use and bass lowest note | `state.drumBeat`, `state.bassWrapLow` |

`buildChord(block, rootIndex, modeIndex)` already took the key and mode.

## Additions the app does not have

Two optional block fields. A block without them builds exactly as the app's did, which `test_matches_original.mjs` checks.

- `flat5`: lowers the 5th a semitone on any chord (diatonic, applied or free). Named `C(b5)`, `G7b5`, `Cmaj7b5`; a minor chord with a ♭5 is the usual `m7b5`. Aug wins if both are set; the leading-tone chord already has one.
- `chordSource: "free"` with `freeRoot` (pitch class 0-11) and `freeQuality` (`major`, `minor`, `dominant` or `diminished`): a chord on any root, outside the key's scale, with every extension, sus, aug, ♭5, inversion, drop and octave option. Its root sits within the octave above the key root, as degrees do.

## Notes for clips

`src/notes.js` adds `sectionToNotes(blocks, settings)`, which turns a section into three note lists (chords, bass and drums) for the device to write into clips. It follows how the app plays a section: each chord is held for its block, the bass lanes restart at every block, and the drums run on a 16-step grid from the start of the section. It also adds `patternHasHitAtStep`, copied from the app like the rest of `engine.js`.

`src/engine.d.ts` and `src/notes.d.ts` describe both files for TypeScript callers such as the device. The code itself stays plain JavaScript.

## Tests

    sh run_tests.sh

Expect eight `ok` lines.

- `test_matches_original.mjs` loads the original app and checks that the engine gives identical answers across about 1.4 million checks: every key, home mode, borrowed mode, degree, extension, sus and aug setting, all applied chords, and every beat and bass setting.
- The other five are the original tests, pointed at the engine. Their checks are unchanged; only the setup at the top differs. `test_inversion_labels` leaves out its final section, which tests the app's editor dropdown rather than the engine and belongs with the editor (build plan step 5).
- `test_free_flat5.mjs` checks free mode and flat five against hand-written expectations.
- `test_notes.mjs` checks `src/notes.js` against hand-written expectations.
- `test_extension_fix` is not ported. It tests the Learn lessons, which the device does not carry over. It still runs against the original app with `sh original/run_tests.sh`.
