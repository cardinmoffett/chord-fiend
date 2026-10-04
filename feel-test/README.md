# feel-test/ : the feel tests in Live (build plan step 3)

One test device, **chord-fiend-test**: a MIDI effect with a big editor window. The window holds the song, and Live's Arrangement follows it automatically: every part of the song is a set of clips on a chords, a bass and a drums track. It is not the finished editor; it is where we work out how the editor should feel, one round at a time.

The device is in `chord-fiend-feel-test.zip`. This is **round 3**.

## Install

1. Open the zip on GitHub: [feel-test/chord-fiend-feel-test.zip](https://github.com/cardinmoffett/chord-fiend/blob/claude/loving-ramanujan-zfphj8/feel-test/chord-fiend-feel-test.zip), and click **Download raw file**.
2. Double-click the zip. You get a folder called **Chord Fiend Feel Test** with one file, `chord-fiend-test.amxd`.
3. Put it in your User Library, replacing the old one. If an older version is on a track, delete it from the track first: Live keeps its own copy of a device in the Set.

## Set up

1. Have three MIDI tracks with instruments: chords, bass, and a **Drum Rack** for drums. The drums use the General MIDI notes: kick C1 (36), snare D1 (38), closed hi-hat F#1 (42).
2. Put **chord-fiend-test** on the chords track and switch to **Arrangement View** (Tab).
3. Click **Open editor** on the device.
4. Click **⚙** (top right of the window) and pick the three tracks under **Tracks**. The song appears on the Arrangement straight away, and the top bar says **Arrangement in sync**.

A Set saved with an earlier round opens with its song intact.

## Round 3: what changed

From your notes on round 2:

- **One transport** across the top: **▶** play, **■** stop, **⟲** loop. Loop loops **whatever is selected**: a chord in the section you are editing, a song part, or the whole song (nothing selected in the song view). Clicking a chord only selects it, so a loop keeps playing while you click around and edit. To move the loop to what you just selected, click **Loop selection**, which appears next to the loop button.
- **Two views, as in the app.** The **song view** has the song row (with the link icon) and the sections below it. Click a part to select it, double-click to edit it; **+** adds a section after the selected part. Click a section below to edit it, or **+** for a new one. The **section view** is the block editor; **← Song** goes back.
- **Compact blocks** in rows of 4 bars, as wide as they are long, so long progressions fit. Each is coloured by degree (the app's colours: hue from the degree, richer for bigger extensions, darker for applied chords, grey for free chords) and shows the **degree large** and the chord name small.
- **An inspector** for the selected block, with **Diatonic / Applied / Free**:
  - Diatonic: degree and mode (borrowing).
  - Applied: function (dominant of, tritone sub of, leading-tone into) and target.
  - Free (new): any root, as major, minor or dominant.
  - For every block: extension, sus, fifth (5, ♭5 new, ♯5 aug), inversion, drop, octave, duration and feel (straight, dotted, triplet).
  - **↺** back to the key's I chord, **←** **→** move, **✕** remove. **+ Add** (top right) inserts after the selected block.
- **No Write button and no start bar.** The song starts at bar 1, and every edit updates the Arrangement by itself, only touching the clips that changed.
- **No bass toggles.** Bass is always written; mute it in Ableton.
- **Settings drawer** (⚙): key, mode, beat; tracks; bass lowest note. Also **Remove Chord Fiend clips**, and an activity list for troubleshooting.
- **Clip colours** in Live match each section's colour in the window.

## Try it

There are no fixed checks this round. Build a song the way you would want to: make sections, give them long progressions, place them, loop things while editing, use applied and free chords, and rearrange. Then tell Claude what works and what gets in the way.

If something fails, a screenshot of the window helps, and so does the **Activity** list in ⚙.

## Results so far

**Round 1 (2026-10-04):** all four checks passed on Cardin's Mac: the big window, writing and replacing clips on three tracks, looping and rewriting mid-loop with no stuck notes, and saving and reopening. Pasting worked. The per-block loop buttons stood in well for the app's single-block compare.

**Round 2 (2026-10-04):** sections, song order, linking and detaching worked, but the layout did not. Decided from Cardin's notes:

- The window decides where parts go, working like the mobile app, and the Arrangement is an automatic mirror: no Write button, no start bar.
- A consolidated, visual transport. The chord's degree matters more than its name.
- Big editable blocks in one line fit about 10 chords: not enough. Use compact blocks and an inspector, as the app does, with insert, move, reset and remove.
- Every block needs every setting, plus Diatonic / Applied (as in the app) and a new Free mode; flat five is new too.
- No bass toggles (mute in Ableton).
- Order of use: transport, chord blocks, then key/mode/beat, then tracks and bass lowest note. The last two belong in a settings drawer.

## Notes for Claude Code

- Source: `device/` (an `m4l-jweb` 1.6.1 project). Build with `cd device && pnpm install && pnpm build && pnpm test`; the device is `device/dist/chord-fiend-test/chord-fiend-test.amxd`. SHA-256 of the one in the zip: `c2365c7342307906a62a3eddaff8c6999c4e47434448c704c7693a9dc9eec869`.
- `device/patches/@m4l-jweb__wrapper@1.6.1.patch` (applied by pnpm) carries the two Mac fixes: `pageUrl()` for the `Macintosh HD:` page address, and a retry that re-sends a page's URL every 2 s, up to 3 times, until the page says `ui_ready`.
- UI: `Editor.tsx` (transport, song view, section view, block rows, settings drawer, sync), `Inspector.tsx`, `editor.css`.
- The song model is `device/src/app/chord-fiend-test/song.ts`: sections, slots (linked, or detached with their own blocks), `layoutSong` (slots end to end from bar 1, bass always on), `planSongWrite`, `blockLabel`, `blockColor` and `sectionColor`. The window syncs on every change (150 ms debounce), after the track list arrives, and the first sync after opening sends every clip. A sync is, per role, a `cf_prune` (only when clip names or ranges changed) and then a `cf_write` per clip that is new or changed. Clip names are `<position> <section>[*] - <role>`, unique per track. Older saved songs are converted by `normalizeSong`.
- The window's requests (`cf_tracks`, `cf_prune`, `cf_write`, `cf_clear`, `cf_loop <start> <length> [jump]`, `cf_unloop`, `cf_play`, `cf_stop`) are handled in `device/wrapper/device.ts` through `onWindowMessage`, with base64 JSON payloads. `onTick` forwards the transport poll to the window. `cf_write` also sets the clip colour.
- Our clips are recognized by name: `Chord Fiend: <name>`. A write whose clip already covers the same range replaces the notes in place (`remove_notes_extended` + `add_new_notes`); otherwise a new clip is created (`Track.create_midi_clip`) after `cf_prune` has deleted stale ones (`Track.delete_clip`). Clips moved or edited by hand in Live are not followed; the next sync overwrites them (hand-edit protection is build plan step 6).
- Tests: `device/tests/wrapper-live.test.mjs` (the Live side against a fake Max and Live set) and `device/tests/song.test.ts` (the song model, labels, and whole-song syncs end to end through the wrapper into the fake). The fake follows the Live Object Model docs, so it checks our logic, not Live itself.
- Engine additions for this round: `flat5` and `chordSource: "free"` in `engine/src/engine.js`, tested in `engine/tests/test_free_flat5.mjs`.
