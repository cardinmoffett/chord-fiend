# Chord Fiend

This repo holds two products that are developed side by side. Both matter; don't treat either as the "main" one.

- `mobile/`: the phone app. Read `mobile/CLAUDE.md` before working on it.
- `device/` (plus `feel-test/`, `spike/`, `docs/build-plan.md`): the Ableton Live device. Read `device/README.md` and the build plan.
- `engine/`: the chord engine both products share. The phone app holds a generated copy of it (between the SHARED ENGINE markers in `mobile/index.html`). After any engine change: run `sh engine/run_tests.sh`, then `cd mobile && npm run sync-engine && npm test`, and check the device still builds.
- `original/`: frozen reference copy of the phone app. Never edit.

## Working with the owner

The owner is not an engineer. Make the technical calls yourself and tell them what you decided and why in a sentence or two. Don't hand them a menu of options or ask them to learn the tooling. Ask only when the answer is really theirs to give (what the product should do or feel like). Say what you checked and what you assumed.

## Git

Work on a branch and push it. Changes reach `main` through a pull request.
