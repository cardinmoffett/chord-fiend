# Chord Model Plan

Shared engine (`engine/`), used by the phone app and the Ableton device. Agreed 2026-10-10.

## Why

Every chord is built by stacking thirds from the key's scale, with a few tweaks (Extension, Sus, Fifth). That's why some common chords can't be made:
- **add9:** a 9 can't be added without the 7.
- **Minor-major 7th:** only reachable by borrowing harmonic minor on the right degree.
- **Altered chords:** ♭9, ♯9, ♯11 and similar don't exist.

The fix should keep the app feeling guided: everything starts from what the key gives you, and every change from that is visible and easy to undo.

## The model: three layers per block

| Layer | What it is | Default |
|---|---|---|
| **Root** | Where the chord comes from: a degree plus mode (diatonic or borrowed), an applied function plus target, or a free root | Today's controls |
| **Type** | The formula: which tones sit above the root, each with a role (1, 3, 5, 7, 9, 11, 13; 2 and 4 for sus; 6) | **From the key**, which is today's behavior, with Extension, Sus and Fifth as tweaks |
| **Voicing** | Where each tone sits | A rule (inversion, drop, octave), later optionally a hand-placed shape |

- **Hand-placed voicings will be stored by role, not by pitch,** so a shape survives a key change or a move to another degree. Tones outside the chord are stored as flagged extra tones.
- **The engine translates both ways:**
  - **Forward:** block → notes. This is `buildChord`.
  - **Reverse:** notes plus key → a ranked list of blocks that would produce them, in the app's own terms: a degree, borrowed, applied or free chord, plus a type. The guided answers come first.
- **The reverse direction powers three features:**
  - suggestions in the voicing editor
  - reharmonization suggestions (melody notes → chords that fit)
  - smarter lesson feedback

## Build order

1. **Chord types** (this step):
   - **Type dropdown:** a Type control whose first option is "From the key", followed by named types: add9, m(maj7), 6/9, 7♭9 and so on.
   - **Tones carry roles:** chord names and the bass part both read the roles, so a sus or add9 chord plays sensible bass notes.
   - **Nothing existing changes:** saved songs and lessons without a type behave exactly as before.
2. **Reverse lookup:** notes → candidate blocks, tested on its own in the engine.
3. **Voicing editor** (later, see below).
4. **Reharmonization suggestions,** built on the reverse lookup and the melody lane in Learn.

## Voicing editor (later; architecture must keep room for it)

- **Opening it:** it opens from a block and shows that block's notes on a piano roll. It uses the same key-step rows and colors as the melody lane.
- **Three blocks at once:** the **previous, current and next** blocks sit side by side in the editor. Tapping the previous or next block **moves the editor's focus** to it, so you can work on a stretch of the progression together and see where every voice is going.
- **On rails:**
  - Chord tones are highlighted.
  - Other notes are dimmed and locked, until a toggle, **Allow other notes**, is turned on.
- **Editing:** you move notes up or down, to another chord tone or to another octave.
- **Suggested names:** as you edit, the editor offers the chords your notes might actually be, from the reverse lookup. Tap one to **commit** the block to that name; the root and type update to match. Suggestions that also move the voices smoothly from the previous block rank higher.
- **Why it matters:** this supports working from feel. Put a voice where you hear it going (the 5, say), then let the app name the harmony.
- **Saving:** a hand-placed shape is saved as the block's voicing, stored by role as described above. A visible reset button returns it to the rule-based voicing.

## Rules for every step

- Default to "From the key". Overrides are visibly marked and have a one-tap reset.
- Never change how an existing saved block sounds. New fields are optional and absent on old blocks.
- Change chord logic in the engine only (`engine/src/engine.js`). Then run the engine tests, `npm run sync-engine` and `npm test` in `mobile/`, and check that the device still builds.
- Write expected notes and names in tests from theory, never copied from the code's output.
