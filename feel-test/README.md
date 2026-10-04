# feel-test/ : the feel tests in Live (build plan step 3)

One test device, **chord-fiend-test**, for the four checks in step 3 of the plan. It is a MIDI effect with a big editor window. The window holds a short chord progression made by the real chord engine, and it writes chords, bass and drums into Arrangement clips on three tracks. It is not the real editor yet: the point is to find out how this way of working feels before we build that.

The device is in `chord-fiend-feel-test.zip`.

## 1. Install

1. Open the zip on GitHub: [feel-test/chord-fiend-feel-test.zip](https://github.com/cardinmoffett/chord-fiend/blob/claude/loving-ramanujan-zfphj8/feel-test/chord-fiend-feel-test.zip), and click **Download raw file**.
2. Double-click the zip. You get a folder called **Chord Fiend Feel Test** with one file, `chord-fiend-test.amxd`.
3. Drag the folder into **Music > Ableton > User Library**, as with the earlier test devices.

## 2. Set up a Set

1. Open a new Set in Live.
2. Make three MIDI tracks and name them **Chords**, **Bass** and **Drums** (double-click a track name to rename it).
3. Put an instrument on each one: a piano or pad on Chords, a bass sound on Bass, and a **Drum Rack** kit on Drums.
4. Drag **chord-fiend-test** onto the **Chords** track. It sits in front of the instrument, and the chords still reach the instrument through it.
5. Switch to **Arrangement View** (the **Tab** key).
6. Click **Open editor** on the device. A window called **Chord Fiend (feel test)** opens.
7. In the window, pick the three tracks in **Chords track**, **Bass track** and **Drums track**. If a track is missing from the lists, click **Refresh tracks**.

The drums are written on the standard General MIDI notes: kick on C1 (36), snare on D1 (38) and closed hi-hat on F#1 (42). Most of Live's Drum Rack kits use those, but if a sound is wrong or missing, note which one.

If the device or the window shows "Your file couldn't be accessed", wait two seconds: it now retries by itself. If it is still there after about ten seconds, note it.

## 3. The four checks

### Check 1: does the big window feel good to use?

Use the window for a few minutes: change chords, resize the window, move it around, and click back and forth between it and Live.

**Tell Claude** what felt good and what got in the way. For example: the window falls behind Live when you click Live, it is slow to respond, the text is too small, or resizing does not work.

### Check 2: writing to three tracks, and replacing clips cleanly

1. Click **Write to Arrangement**.
2. **It works if** three clips appear at bar 1, one on each track, named **Chord Fiend: chords**, **Chord Fiend: bass** and **Chord Fiend: drums**, each 4 bars long.
3. Click **Play from start**. You should hear the progression C, Am, F, G7 with bass and drums.
4. Change **Start at bar** to 5. With **Rewrite on every edit** ticked, the clips should move to bar 5 and no copy should be left at bar 1.
5. Draw a clip of your own on one of the three tracks, somewhere else on the timeline. Then click **Remove our clips**. **It works if** only the Chord Fiend clips disappear and yours stays.

### Check 3: looping a block, and changing it while it loops

1. Click **Write to Arrangement** again.
2. Click **Loop** on the **G7** block. Live should loop just that bar and start playing, and the block should light up green while it plays.
3. While it loops, change that block's **Degree**, **Ext** or **Inversion** a few times, quickly.
4. **It works if** each change is heard straight away (within the bar), and no note hangs on after it should have stopped.
5. Try **Loop section** too, then **Stop**. After **Stop**, Live's own loop should be back to where it was before you started.

### Check 4: does the song survive saving and reopening?

1. Make a few changes in the window, such as a different key or an extra block, and write them.
2. Save the Set, close it, and open it again.
3. Click **Open editor**. **It works if** your progression, key, beat and track choices are all still there, and the clips are still in the Arrangement.

### Extra: pasting

Copy some text from anywhere on your Mac and paste it into the **Paste test** box in the window (Cmd+V). The plan lists pasting inside a device as unverified, and the real editor needs it to paste songs in from the mobile app.

## 4. Report back

For each check, tell Claude whether it worked, and how it felt. If something failed, these help:

- a screenshot of the window, including the **Log** box at the bottom left;
- any lines in the Max Console starting with `chord-fiend:` or `m4l-jweb:` (open the device's Edit window, then **Window > Max Console**, as before).

## Notes for Claude Code

- Source: `device/` (an `m4l-jweb` 1.6.1 project). Build with `cd device && pnpm install && pnpm build && pnpm test`; the device is `device/dist/chord-fiend-test/chord-fiend-test.amxd`. SHA-256 of the one in the zip: `8f87f5aab779a5abc77e2f47757ed8985cb456d56b498ac29b1a736593d7e5cd`.
- `device/patches/@m4l-jweb__wrapper@1.6.1.patch` (applied by pnpm) carries the two Mac fixes: `pageUrl()` for the `Macintosh HD:` page address, and a retry that re-sends a page's URL every 2 s, up to 3 times, until the page says `ui_ready`.
- The window's requests (`cf_tracks`, `cf_write`, `cf_clear`, `cf_loop`, `cf_play`, `cf_stop`) are handled in `device/wrapper/device.ts` through `onWindowMessage`, with base64 JSON payloads. `onTick` forwards the transport poll to the window.
- Our clips are recognized by name: `Chord Fiend: <role>`. A write whose clip already covers the same range replaces the notes in place (`remove_notes_extended` + `add_new_notes`); anything else deletes our old clip for that role (`Track.delete_clip`) and creates a new one (`Track.create_midi_clip`). This is the simplest form of the plan's open decision on recognizing our own clips.
- `device/tests/wrapper-live.test.mjs` runs the built wrapper against a fake Max and a fake Live set. The fake follows the Live Object Model docs, so it checks our logic, not Live itself. Unverified in Live: that `create_midi_clip` returns the new clip's id, that `delete_clip` takes an Arrangement clip, and that `back_to_arranger` = 0 takes the tracks back to the Arrangement.
- Notes come from `engine/src/notes.js` (`sectionToNotes`), which follows the app's own playback: chords held for the block, bass lanes restarted per block, drums on a 16-step grid from the section start.
