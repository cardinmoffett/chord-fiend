# original/ : snapshot of the Chord Fiend / Modal Interchange Sketchpad web app

Taken 2026-10-04. This is the single-file mobile web app (one HTML file of plain JavaScript, with Tone.js loaded from a CDN) as it stood when the Ableton device rebuild was planned. It is the reference for the chord engine, the auto drum and bass generator, and the block editor that the device will reuse.

## Contents

- `modal-sketchpad.html`: the app, byte for byte what is published (4,991 lines).
- `tests/`: six Node tests, byte for byte as they were written.
- `tools/make_inner.js`: generates the one file that four of the tests read (see below).
- `run_tests.sh`: runs all six.

## Run the tests

    sh run_tests.sh

Needs Node only. Expect six `ok` lines, and a non-zero exit if any test fails.

## Why there is a runner

The tests hard-code two absolute paths from the sandbox they were written in:

- `/home/claude/modaltoy/index.html`, the app.
- `/home/claude/inner_regress.js`, which is not source. It is the app's script body with the outer wrapper removed, generated from the HTML. Four tests read it; `test_inversion_labels` and `test_drops` extract the same thing from the HTML themselves.

The runner recreates that layout in a temp folder, generates the file with `tools/make_inner.js`, and points copies of the tests at it. Nothing in `tests/` is modified. Each test carries its own mock DOM and mock Tone inline, and there are no other helper files. When the chord engine is extracted into a package, replace the two `readFileSync` lines in each test with an import.

## What each test covers

- `test_applied`: applied chords (secondary dominant, tritone substitution, leading-tone), their fixed intervals, the functional label, and that the diatonic path is unchanged.
- `test_enharmonic2`: sharp and flat spelling of chord names, such as flats in C natural minor.
- `test_minorlabel`: applied-chord target labels follow the home mode ("Dominant of I" in major, "Dominant of i" in minor).
- `test_extension_fix`: Learn lessons only. It checks that following a lesson's literal edit instructions produces the 7th chord the lesson describes. It depends on the Learn curriculum inside the HTML, which the Ableton device does not carry over.
- `test_inversion_labels`: inversion labels written as chord degrees, every combination checked against what actually sounds, existing songs unchanged where they were already correct, and stored inversions that no longer fit being clamped.
- `test_drops`: drop 2, drop 3 and drop 2+4 voicings, checked against the textbook definition for 70,560 combinations, with root-position and no-drop voicings unchanged.

## Not included

The other 29 test files from the sessions (gestures, scrolling, audio, persistence, instruments, label dropdowns and the curriculum) were not exported. They exist only in the original sandbox.
