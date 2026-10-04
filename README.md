# Chord Fiend

A Max for Live device for Ableton Live: a block editor for chord progressions that writes chords, bass and drums into Arrangement clips. The full plan is in [`docs/build-plan.md`](docs/build-plan.md).

## What's here

- `docs/build-plan.md`: the build plan (what we're building, scope, build order, open decisions, technical notes).
- `engine/`: the chord engine as a standalone package, taking key and mode as parameters (build plan step 4). See [`engine/README.md`](engine/README.md).
- `original/`: a snapshot of the mobile web app taken on 2026-10-04, plus the six chord-engine tests. This is the reference copy and is not edited. See [`original/README.md`](original/README.md).

## Run the tests

    sh engine/run_tests.sh      # the engine package
    sh original/run_tests.sh    # the original app

Needs Node only. Expect six `ok` lines from each.
