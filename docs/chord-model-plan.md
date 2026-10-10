# Chord Model Plan

Shared engine (`engine/`), used by the phone app and the Ableton device. Agreed 2026-10-10.

## Why

Every chord is built by stacking thirds from the key's scale, with a few tweaks (Extension, Sus, Fifth). That's why some common chords can't be made:
- **add9:** a 9 can't be added without the 7.
- **Minor-major 7th:** only reachable by borrowing harmonic minor on the right degree.
- **Altered chords:** ♭9, ♯9, ♯11 and similar don't exist.

The fix should keep the app feeling guided: everything starts from what the key gives you, and every change from that is visible and easy to undo.

## The model: where the root comes from, plus Alter

Revised 2026-10-10, twice:
- **A flat list of chord types was dropped.** It was overloaded, and it hid basics like the dominant.
- **A strict "only Free can step off the key" rule was relaxed.** It slowed down quick edits and lost the numbered spelling.

**The principle: every chord keeps a number in the key.**

**Category: where the root comes from.**

| Category | Root | Base formula |
|---|---|---|
| **Diatonic** | A degree of the key's scale | The scale's own tones (Shape, Sus) |
| **Borrowed** (diatonic plus a Mode) | Same degree, another mode's scale | That mode's tones. The Mode list shows results ("Dorian → F7"). |
| **Applied** | A function: dominant of, tritone sub of, leading-tone into a target | The function's formula |
| **Free** | A step from the key's root (`freeRoot`, 0-11), shown as a numeral: ♭II, III, ♯IV… | A Quality: Major, Minor, Dominant, Diminished, Augmented, Half-diminished |

**Alter**, available on every category except the fixed leading-tone dim7:
- It's a collapsed group that opens on its own when a block has an alteration.
- **3rd** (`third`): major or minor.
- **5th** (`fifth`): ♭5, 5 or ♯5. The older `aug` and `flat5` fields still work. "5" is what gives vii° a perfect 5th.
- **7th** (`seventh`): maj, ♭7 or °7, when the shape has a 7th.
- **Tension** (`tension`): ♭9, ♯9, ♯11 or ♭13, when the shape has that tone.
- Unset means "what the source gives".
- **Editors show the chord's real values,** so a V7 shows Major, 5, ♭7. Choosing the key's own value clears the change (`withoutAlter` gives the unaltered block).
- The engine applies all of these in one place in `buildChord`.

**Shape** (`extensionIndex`, editors use `SHAPE_ORDER`): Triad, add9, 6, 6/9, 7, 9, 11, 13.

**Labels (`blockLabel`) are always numerals, read from the chord's real notes:**
- The case shows the 3rd, then °, + or ø.
- The 7th's kind: maj7, 7, (maj7), °7.
- Then shape, tension, sus, and ♭5/♯5.
- Examples: ii with a major 3rd and ♭7 reads II7; IVmaj7; V+7; vi(maj7); V7(♭9)/ii.
- **Free chords read their step:** III, ♭VI, ♭III (E♭, spelled to match the step). Diminished free chords take sharp steps, as leading-tone chords: ♯i°7 = C♯dim7 in C.
- The chord name (small) stays in letters.

**Saved songs are not a compatibility constraint.** The owner has said to rearchitect freely.

**The engine translates both ways:**
- **Forward:** block → notes. This is `buildChord`.
- **Reverse:** notes plus key → ranked candidate blocks, most guided first: a plain degree, then borrowed, applied, a degree with Alter, then free. It powers the voicing editor's suggestions, reharmonization suggestions and lesson feedback.

## Build order

1. Done: categories, Shape, Mode listed by result, Alter (3rd, 5th, 7th, Tension), free roots as steps, numeral labels for everything.
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

- On the rails first: every choice starts at what the key gives. Alter is collapsed by default, and any change shows in the block's numeral.
- Change chord logic in the engine only (`engine/src/engine.js`). Then run the engine tests, `npm run sync-engine` and `npm test` in `mobile/`, and check that the device still builds.
- Write expected notes and names in tests from theory, never copied from the code's output.
