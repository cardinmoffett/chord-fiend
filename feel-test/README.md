# feel-test/ : the feel tests in Live (build plan step 3)

One test device, **Theoryaoke** (the file is still `chord-fiend-test.amxd`): a MIDI effect with a big editor window. The window holds the song, and Live's Arrangement follows it automatically: every part of the song is a set of clips on a chords, a bass and a drums track. It is not the finished editor; it is where we work out how the editor should feel, one round at a time.

The device is in `chord-fiend-feel-test.zip`. This is **round 5**.

## Install

1. Open the zip on GitHub: [feel-test/chord-fiend-feel-test.zip](https://github.com/cardinmoffett/chord-fiend/blob/main/feel-test/chord-fiend-feel-test.zip), and click **Download raw file**.
2. Double-click the zip. You get a folder called **Theoryaoke Feel Test** with one file, `chord-fiend-test.amxd`.
3. Put it in your User Library, replacing the old one. If an older version is on a track, delete it from the track first: Live keeps its own copy of a device in the Set.

## Set up

1. Have three MIDI tracks with instruments: chords, bass, and a **Drum Rack** for drums. The drums use the General MIDI notes: kick C1 (36), snare D1 (38), closed hi-hat F#1 (42).
2. Put **chord-fiend-test** on the chords track and switch to **Arrangement View** (Tab).
3. Click **Open editor** on the device.
4. Click **⚙** (top right of the window) and pick the three tracks under **Tracks**. From then on the Arrangement follows the song, and the top bar says **Arrangement in sync**.

A Set saved with an earlier round opens with its song intact.

## Starting empty

A new device now starts with no song: one section, **Section 1**, holding the key's I chord, and nothing in the song row, as the app started a new project. Add sections and place them to build your song. A Set you have already saved keeps its song. (Earlier rounds started with a sample Verse, Chorus, Verse, Chorus; the tests still use it.)

## Round 5: songs between the phone and Live

- **Phone → Live.** On the phone, open the project menu and tap **Send to Live**: it copies the song. In Live, open ⚙ and click **Paste from phone…**, press ⌘V, check the line that says what's in it, then **Replace this song**. It replaces the device's song (it asks first); the tracks you chose stay. A 3/4 song sets Live to 3/4.
- **Live → phone.** In Live, ⚙ → **Copy for phone**, press ⌘C. On the phone, project menu → **Paste from Live…** → **Paste** → **Add as a new project**. It never replaces a phone project. It brings Live's tempo.
- **What travels:** sections, the song order, which parts are linked and which have their own chords, every chord setting, key and mode, the beat, 3/4, and the bass lowest note. Sounds, effects and strum stay on the phone; Live's tempo stays Live's.
- The text works as a backup too: paste it into Notes and bring it back later.

## Round 4.1

- **Length icons** are drawn now. Live's window has no font with the music note characters, so they showed as boxes (as they did on the iPhone).

## Round 4: the new chord editor, 3/4, copy and paste, linked parts as in the app

- **The new chord editor**, built since round 3 but not in your Live until now, laid out like the phone app's drawer: **Diatonic / Applied / Free** tabs, coloured chord pads (one click sets the chord), **Length** (a note plus Straight / Dotted / Triplet, ties and splits), **Shape**, **Inversion** (▲ ▼ through the octaves), **Spread** (drop voicings), and **Alter** (one row per chord tone, plus Borrow). Applied has every function the app has: Dominant, Applied ii, Tritone sub, Backdoor, Leading tone, Common-tone dim and Mediants.
- **3/4.** The song follows **Live's time signature**: set the Set to 3/4 and, within two seconds, chords a bar long become a dotted half, the beat becomes the Waltz, the Beat menu lists the 3/4 beats (Waltz, Jazz Waltz, Slow 3/4), and new chords are a bar of 3. Set it back to 4/4 and it goes back. Any other signature is written as 4/4 (the Activity list says so).
- **Copy and paste.** **Shift-click** a second chord to select everything between (a blue outline). **Copy** (⌘C) takes the selection, or the one selected chord; **Paste** (⌘V) inserts it after the selection, in any section or part. **←** **→** move the whole selection, **✕** (or Delete) removes it.
- **Play loops the selection** when several chords are selected; otherwise it loops the whole section from the selected chord, as before.
- **Linked parts as in the app.** A linked part still opens locked (greyed out), now with two buttons over it: **Edit source** opens the section (the change shows in every part linked to it), **Edit instance** gives this part its own copy (`Verse*`). An inline part has **🔗 New linked section**: its chords become a new section (`Verse 2`), and the part links to it. **Relink is gone**: it threw away the part's own chords.
- **The name is Theoryaoke**: the window, the device strip, and the clips (`Theoryaoke: 1 Verse - chords`). Clips written by earlier rounds as `Chord Fiend: ...` are replaced on the first sync.

## Round 3.3: the song part menu as a flyout

- **Click a part** in the song row and its menu opens as a flyout attached to the card: **←** **→** move it, **✕** removes it, and **+ Add** lists your sections, inserting the one you pick right after this part. Click away or press Escape to close it.
- The chord editor is unchanged from 3.2.
- **Fix:** Play in the song view started from the wrong place instead of the selected part. Live's start_playing can begin from its own start marker rather than the playhead set just before it while stopped, so the device now sets the position again once playback has started. The section editor's Play (from the selected chord) uses the same step.

## Round 3.2: linked and inline parts, a cleaner song view

From your notes on round 3.1:

- **Less labelling.** Cards show only the name (and 🔗 on a linked part). No bar ranges, chord counts, hints, or "Part 1: Verse" line.
- **The sections palette sits at the bottom** of the song view, below a divider, apart from the song builder.
- **A selected part** shows only **←** **→** (move) and **✕** (remove), in a flyout from 3.3. A selected section shows only **Duplicate**.
- **Linked and inline, as in the app** (replaced in round 4). Double-click a part to open it:
  - A **linked** part opens **locked**: you can see, tap and play its chords, but not change them. Next to its name is **Make inline**.
  - **Make inline** gives that part its own copy (shown as `Verse*`), which you edit on its own; its section and the other parts do not change.
  - An inline part has **Relink**, which asks first, because it throws away that part's own changes and follows the section again.
  - To change a section everywhere it is used, double-click it in the palette.
- **Diminished** joins major, minor and dominant in Free mode (`B°`, `B°7`, a fully diminished 7th).

## Round 3.1: preview and loop

From your notes on round 3:

- **Play** depends on the view. In the **section editor** it loops the whole section, starting from the selected chord. In the **song view** it plays the song from the selected part (or the start). **■** stops. The separate loop button is gone.
- **Tapping a chord plays it**, through the chords track's instrument, but only while stopped. During playback a tap only selects, so you can edit along with the music. Changing a setting in the inspector also plays the chord while stopped, as the app does.
- **Dropdowns** open with one click and pick with another. The old ones only stayed open while the mouse button was held.
- **Duplicate** moved to the song arranger. Rename and **Delete section** stay in the section editor.

## Round 3: what changed

From your notes on round 2:

- **One transport** across the top (changed in 3.1, above).
- **Two views, as in the app.** The **song view** has the song row and the sections palette; **+** adds a section after the selected part. The **section view** is the block editor; **← Song** goes back. (Refined in 3.2.)
- **Compact blocks** in rows of 4 bars, as wide as they are long, so long progressions fit. Each is coloured by degree (the app's colours: hue from the degree, richer for bigger extensions, darker for applied chords, grey for free chords) and shows the **degree large** and the chord name small.
- **An inspector** for the selected block, with **Diatonic / Applied / Free**:
  - Diatonic: degree and mode (borrowing).
  - Applied: function (dominant of, tritone sub of, leading-tone into) and target.
  - Free (new): any root, as major, minor, dominant or (from 3.2) diminished.
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

- Source: `device/` (an `m4l-jweb` 1.6.1 project). Build with `cd device && pnpm install && pnpm build && pnpm test`; the device is `device/dist/chord-fiend-test/chord-fiend-test.amxd`. SHA-256 of the one in the zip (round 5): `7acd50df343c5c24510aa2b67dc668cca59caf620cfa3401b2785cdcaa9edcf8`. The zip holds it in a `Theoryaoke Feel Test` folder.
- `device/patches/@m4l-jweb__wrapper@1.6.1.patch` (applied by pnpm) carries the two Mac fixes: `pageUrl()` for the `Macintosh HD:` page address, and a retry that re-sends a page's URL every 2 s, up to 3 times, until the page says `ui_ready`.
- UI: `Editor.tsx` (transport, song view, section view, block rows, settings drawer, sync), `Inspector.tsx`, `editor.css`.
- The song model is `device/src/app/chord-fiend-test/song.ts`: sections, slots ("parts": linked, or inline with their own blocks; a linked part opens locked, see `editingLocked`, with Edit source / Edit instance over the inspector; `inlineSlot`, `slotToNewSection`; no Relink, on purpose), the meter (`beatsPerBar` from Live's signature via `cf_meter`, polled every 2 s; `setMeter` converts bar-long chords and the beat as the app's time-signature setting does; `barBlock`), `layoutSong` (slots end to end from bar 1, bass always on), `planSongWrite`, `blockLabel`, `blockColor` and `sectionColor`. The window syncs on every change (150 ms debounce), after the track list arrives, and the first sync after opening sends every clip. A sync is, per role, a `cf_prune` (only when clip names or ranges changed) and then a `cf_write` per clip that is new or changed. Clip names are `<position> <section>[*] - <role>`, unique per track. Older saved songs are converted by `normalizeSong`.
- Tapping a chord while stopped sends `cf_audition` from the window; the wrapper passes it to the device page (`outlet 0`), which plays it with `sendNote` through the `midiout` chain. The patcher keeps its `midiin -> midiout` cord, so clips on the track still pass through. `Dropdown.tsx` replaces every native `<select>`: in the window, a native select's popup only stayed open while the mouse button was held.
- Sharing with the phone: `songToShared` / `sharedToSong` in `song.ts` convert to and from the engine's shared song format (`encodeSharedSong` / `decodeSharedSong`); `ShareDialog` in `Editor.tsx` does Copy for phone (waits for the browser's copy event, since a programmatic copy in jweb can't be trusted) and Paste from phone (replace, after a summary). A pasted song's meter goes to Live with `cf_set_meter`, and the meter poll waits up to 6 s for Live to show it (`pendingMeter`) so the old meter can't convert the new song back.
- The window's requests (`cf_tracks`, `cf_meter`, `cf_set_meter`, `cf_prune`, `cf_write`, `cf_clear`, `cf_loop <start> <length> [jump] [from]`, `cf_unloop`, `cf_audition`, `cf_play`, `cf_stop`) are handled in `device/wrapper/device.ts` through `onWindowMessage`, with base64 JSON payloads. `onTick` forwards the transport poll to the window. `cf_write` also sets the clip colour.
- Copy/paste and selection (`anchor` + `selectedBlock`, shift-click) live in `Editor.tsx`; the clipboard lasts while the window is open. Play with a selection sends `cf_loop` for just those chords (`loopTarget`).
- Our clips are recognized by name: `Theoryaoke: <name>`, and the old `Chord Fiend: <name>` (pruned on the next sync). A write whose clip already covers the same range replaces the notes in place (`remove_notes_extended` + `add_new_notes`); otherwise a new clip is created (`Track.create_midi_clip`) after `cf_prune` has deleted stale ones (`Track.delete_clip`). Clips moved or edited by hand in Live are not followed; the next sync overwrites them (hand-edit protection is build plan step 6).
- Tests: `device/tests/wrapper-live.test.mjs` (the Live side against a fake Max and Live set) and `device/tests/song.test.ts` (the song model, labels, and whole-song syncs end to end through the wrapper into the fake). The fake follows the Live Object Model docs, so it checks our logic, not Live itself.
- Engine additions for this round: `flat5` and `chordSource: "free"` in `engine/src/engine.js`, tested in `engine/tests/test_free_flat5.mjs`.
