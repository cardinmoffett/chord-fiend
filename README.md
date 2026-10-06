# Chord Fiend

Two products built on one chord engine.

| Folder | What it is |
| --- | --- |
| `mobile/` | **The phone app** (Modal Interchange Sketchpad). An installable web app on GitHub Pages. See [`mobile/CLAUDE.md`](mobile/CLAUDE.md). |
| `device/`, `feel-test/`, `spike/`, `docs/` | **The Ableton Live device** (Max for Live). Plan: [`docs/build-plan.md`](docs/build-plan.md). See [`device/README.md`](device/README.md). |
| `engine/` | **The shared chord engine** both products use. See [`engine/README.md`](engine/README.md). |
| `original/` | Frozen copy of the phone app from 2026-10-04. Reference only. |

## Run the tests

    cd mobile && npm test                     # the phone app
    sh engine/run_tests.sh                    # the shared engine
    cd device && pnpm install && pnpm build && pnpm test    # the Ableton device

The first two need Node only. The device needs Node 20+ and pnpm 10+.
