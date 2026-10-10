# Chord Model Plan

Shared engine (`engine/`), used by the phone app and the Ableton device. Agreed 2026-10-10.

## Why

Every chord is built by stacking thirds from the key's scale, with a few tweaks (Extension, Sus, Fifth). That's why some common chords can't be made:
- **add9:** a 9 can't be added without the 7.
- **Minor-major 7th:** only reachable by borrowing harmonic minor on the right degree.
- **Altered chords:** ♭9, ♯9, ♯11 and similar don't exist.

The fix should keep the app feeling guided: everything starts from what the key gives you, and every change from that is visible and easy to undo.

## The model: who decides the notes

Revised 2026-10-10. A flat list of chord types was tried and dropped: it was overloaded, it duplicated what Diatonic already means, and it hid basics like the dominant.

| Category | Who decides the notes | What you choose |
|---|---|---|
| **Diatonic** | The home key's scale | Degree, **Shape** and Sus |
| **Borrowed** (diatonic plus a Mode) | Another mode's scale, on the same tonic | The Mode, listed by its result ("Dorian → F7"), then Shape and Sus |
| **Applied** | The function (dominant of, tritone sub of, leading-tone into) | Function and target, then Shape, Sus, **Fifth** and **Tension** |
| **Free** | You | Root and **Quality** (Major, Minor, Dominant, Diminished, Augmented, Half-diminished), then Shape, Sus, Fifth and Tension |

**The rails are enforced in the engine.** Diatonic and borrowed chords take every note from their scale, so the engine ignores `aug`, `flat5` and `tension` on them.

**How a diatonic chord changes color:** you borrow a mode. Some examples:
- IV7 (a dominant) is IV from Dorian.
- i(maj7) is i from harmonic minor.
- ii⌀7 is ii from Aeolian.
- V7♭9 is V9 from harmonic minor.

**Controls, in order:**
- **Shape** (`extensionIndex`, shown in `SHAPE_ORDER`): Triad, add9, 6, 6/9, 7, 9, 11, 13. These are the scale's own tones; add9 and 6/9 add the scale's 9th without a 7th.
- **Sus:** the scale's 2nd or 4th.
- **Fifth:** ♭5 or ♯5, on applied and free chords only.
- **Tension** (`tension`): ♭9, ♯9, ♯11 or ♭13. It only applies where the chord has that tone (9ths need shape 9/11/13, ♯11 needs 11/13, ♭13 needs 13). Applied and free chords only.
- **Voicing:** inversion, drop and octave. Later, an optional hand-placed shape stored by role (see the voicing editor below).

**Labels:**
- A diatonic 7th says what kind it is: IVmaj7, V7, ii7, vii⌀7, i(maj7).
- Tensions read as V7(♭9)/ii and A7(b9).
- Names come from the notes actually built: Cadd9, C6/9, G9(#11).

**Saved songs are not a compatibility constraint.** The owner has said to rearchitect freely.

**The engine translates both ways:**
- **Forward:** block → notes. This is `buildChord`.
- **Reverse:** notes plus key → ranked candidate blocks in these categories, most guided first: a degree, then a borrowed mode, then applied, then free. It powers the voicing editor's suggestions, reharmonization suggestions and lesson feedback.

## Build order

1. Done: the categories above, with Shape, Mode-by-result, Fifth, Tension and the free qualities.
2. **Reverse lookup:** notes → candidate blocks, tested on its own in the engine.
3. **Voicing editor** (below).
4. **Reharmonization suggestions,** built on the reverse lookup and the melody lane in Learn.

## Voicing editor (later; architecture must keep room for it)

- **Opening it:** it opens from a block and shows that block's notes on a piano roll. It uses the same key-step rows and colors as the melody lane.
- **Three blocks at once:** the **previous, current and next** blocks sit side by side in the editor. Tapping the previous or next block **moves the editor's focus** to it, so you can work on a stretch of the progression together and see where every voice is going.
- **On rails:**
  - Chord tones are highlighted.
  - Other notes are dimmed and locked, until a toggle, **Allow other notes**, is turned on.
- **Editing:** you move notes up or down, to another chord tone or to another octave.
- **Suggested names:** as you edit, the editor offers the chords your notes might actually be, from the reverse lookup. Tap one to **commit** the block to that name; its category, root, mode, shape and other settings update to match. Suggestions that also move the voices smoothly from the previous block rank higher.
- **Why it matters:** this supports working from feel. Put a voice where you hear it going (the 5, say), then let the app name the harmony.
- **Saving:** a hand-placed shape is saved as the block's voicing, stored by role as described above. A visible reset button returns it to the rule-based voicing.

## Rules for every step

- On the rails first: Diatonic and borrowed chords never take off-scale settings; color comes from Mode. Off-scale tools live in Applied and Free.
- Change chord logic in the engine only (`engine/src/engine.js`). Then run the engine tests, `npm run sync-engine` and `npm test` in `mobile/`, and check that the device still builds.
- Write expected notes and names in tests from theory, never copied from the code's output.
