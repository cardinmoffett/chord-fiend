# Melody Editor: Spec (draft for review)

Phone app (`mobile/`). Written 2026-10-07. Nothing here is built yet.

## What it is

A melody lane for each section. It's a piano roll that runs left to right above the chord blocks, and the melody plays together with the chords, bass and drums. It's the foundation for reharmonization later: keep a melody, change the chords under it.

The bass line editor stays as it is. It follows the chord. The melody follows the **key** instead, so changing a chord never changes the tune.

## Layout

**The section view becomes one wide, horizontal line.**
- Time runs left to right and you swipe sideways to move through the section. This replaces today's layout, where the blocks wrap onto several lines.
- Width means time. Every beat is the same width, so a whole-note block is four times as wide as a quarter-note block.
- The chord blocks sit in one strip along the bottom of the timeline. They look and work as they do now: tap to select, the editor drawer below, the same pinning while playing.
- A playhead line runs through the melody and the blocks while playing. The view scrolls to follow it, unless you're scrolling yourself.

**The melody lane sits above the blocks and can be collapsed.**
- A ♪ button in the section header opens and closes it.
- A section with no melody opens collapsed, so you see only the block strip.

**The piano roll:**
- **Rows:** all 12 chromatic steps per octave, labeled by scale step from the key: 1, ♭2, 2, ♭3, 3, 4, ♯4, 5, ♭6, 6, ♭7, 7. There are no note names, so the same melody works in any key. The labels stay pinned on the left as you scroll.
- **Range:** about two octaves are visible, and the roll scrolls up and down within four.
- **Row colors:**
  - The key's scale tones take the color of the chord built on that step, lightened. These are the same colors as the blocks.
  - In A minor, the 1 row (A) is tinted like the i chord, ♭3 (C) like ♭III, and 5 (E) like v.
  - The other five rows are neutral and dim. They're still usable for notes outside the key.
- **The key's root:** every row labeled 1 gets a slightly stronger line, so octaves are easy to find.
- **Rows always follow the song's key**, even under a block borrowed from another mode. A borrowed note then shows as outside the key, which is the point.
- **Grid:** 16th-note columns, with stronger lines on beats and the strongest on bars. Faint vertical lines mark where each chord block starts, so you can see which chord is under each note.

## Entering notes

- **Tap an empty cell** to place a note. It gets the length of the last note you placed, one beat to start with.
- **Drag sideways while placing** to set the note's length.
- **Tap a note** to remove it.
- **One note at a time:** a new note that overlaps others shortens or removes them, because a melody is a single line.
- **Hearing notes:** placing a note plays it, and tapping a row label plays that pitch. Neither makes a sound while the song is playing, matching the block behavior.
- **Scrolling without drawing:** drags on the roll draw notes. To scroll sideways, drag the block strip or the thin beat ruler above the roll. To scroll up and down, drag the row-label column. The rhythm editor solves the same problem with its own scroll strip.

## Playback

- The melody plays in section playback and in whole-song playback. A linked song part plays its section's melody.
- Notes can cross from one block into the next freely.
- **Settings for the melody:** its own instrument (from the same list as chords), its own volume, and a melody on/off switch.
- Edits made while the song plays are heard the first time the playhead reaches them, the same as chord edits now.

## How it's saved

- **Format:** each section gets `melody: { notes: [{ start, length, semis }] }`.
  - `start` and `length` are counted in 16th notes from the start of the section.
  - `semis` is the number of half steps from the key's root: 0 is the root, 12 is the root an octave up, -5 is the 5th below.
- **Changing the key moves the melody with it.**
- **Changing the mode keeps every note's exact pitch.** A natural 3 stays a natural 3 if you switch from major to minor, and then shows as outside the key. That's predictable, and the dim row makes the change visible.
- **Song parts:**
  - A song part that is a separate copy gets its own copy of the melody.
  - A linked part uses the section's melody.
  - Turning a linked part into a separate copy copies the melody too.
- **Shortening a section:** notes past the new end are kept, shown faded, and not played. Lengthening the section brings them back.
- **Older saved songs** have no melody field, and simply start with an empty melody. No other saved data changes.
- **Lessons** can come with a melody already written. The reharmonization lessons will need that.

## Shared with the Ableton device

- A new engine function, `melodyToNotes(melody, rootIndex, ...)`, will turn a melody into notes, the same way `sectionToNotes` does for chords, bass and drums. The engine tests will check it.
- The device doesn't get a melody lane in this work. Because the format is shared, its paste-in step can carry a melody later as a fourth clip.

## Build order

Each step is published on its own so you can try it on the phone.

1. **Wide section layout:** the block strip, beat-based widths, sideways scrolling, and the playhead following along. There's no melody yet. Check that pinning, the drawer and lessons still work.
2. **Melody roll display:** rows, colors, labels, grid, block lines and the ♪ toggle, plus saving a melody.
3. **Note entry:** tap, drag to set length, tap to remove, hearing notes, and scrolling without drawing.
4. **Playback:** the melody's own instrument and volume, and the on/off switch.
5. **Song parts and lessons:** linked and copied parts, whole-song playback, and lessons that come with a melody.

## Decisions taken (say if you want any changed)

- The wide layout replaces the wrapped one in the section view. There's no switch between the two.
- The rows follow the home key, even under borrowed chords.
- A melody is one note at a time, no chords.
- Pitches are saved as half steps from the key's root.
- New notes start one beat long, then take the last length you used.
- You scroll with the block strip, ruler and label column, not by dragging on the roll.

## Later, not in this spec

- Coloring each melody note by how it fits the chord under it.
- Reharmonization suggestions.
- The reharmonization lessons.
- Lesson Unit 10 (chromatic colors), Unit 11 (chord color beyond triads) and Unit 12 (voice leading). These are agreed, and come after this.
