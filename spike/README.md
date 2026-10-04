# spike/ : the Mac test (build plan step 2)

Four small test devices from the `m4l-jweb` build tool. Loading them in Live on your Mac answers the first big question in the plan: does this way of building devices work on your machine? If all four work, we go ahead with `m4l-jweb`. If not, we switch to `js2max` or a hand-made shell, and the chord engine is unaffected either way.

The devices are in `chord-fiend-spike-devices.zip`. They are the tool's own demo devices, with one fix for the Mac (see below). None of them is Chord Fiend yet.

## Replacing the first version

The first zip showed "Your file couldn't be accessed" in every device on the Mac. The current zip fixes that. To swap them:

1. In Live, delete the four old devices from your tracks. Live keeps its own copy of each device in the Set, so the old ones will not update by themselves.
2. In Finder, delete the old **Chord Fiend Spike** folders, including the `.html` and `.stamp` files next to the devices. On your Mac, Live filed them under **User Library > Presets > MIDI Effects > Max MIDI Effect** and **User Library > Presets > Audio Effects > Max Audio Effect**.
3. Download the new zip and follow the steps below again.

## What you need

- Ableton Live 12.2 or newer.
- Live **Suite**, or Live **Standard** with the Max for Live add-on. Intro and Lite cannot run Max for Live devices.

## 1. Download and unzip

1. Open the zip on GitHub: [spike/chord-fiend-spike-devices.zip](https://github.com/cardinmoffett/chord-fiend/blob/claude/loving-ramanujan-zfphj8/spike/chord-fiend-spike-devices.zip). Sign in if GitHub asks.
2. Click the **Download raw file** button (a downward arrow, top right of the file box).
3. Double-click the downloaded zip in your Downloads folder. You get a folder called **Chord Fiend Spike** with four files ending in `.amxd`.

## 2. Put the folder in your User Library

1. In Finder, choose **Go > Home** from the menu bar, then open **Music > Ableton > User Library**.
2. Drag the **Chord Fiend Spike** folder into **User Library**.

If you moved your User Library somewhere else, Live shows where it is under **Settings > Library**.

If your Mac asks whether Live may access a folder, click **Allow**. The devices write a small file next to themselves when they load.

## 3. Try each device

Open Live with a new, empty Set. In Live's browser on the left, click **User Library**, then **Chord Fiend Spike**. Drag each device onto a track as described below.

Every device has a header strip along the top. On the right it shows two version stamps: **ui** and **wrapper**. If **wrapper** shows a dash (`-`), the device's connection to Live did not start. Note that down, because it is the most useful clue if something fails.

### hello-midi (sends notes)

1. Make a MIDI track and put an instrument on it, such as a piano from **Instruments**.
2. Drag **hello-midi** onto the same track. It sits in front of the instrument.
3. Move the **rate** slider away from **off**.
4. **It works if** you hear a note repeating. Press play in Live: the header should switch to **playing**, with the beats counting up and the tempo shown.

### hello-clip (writes a clip)

1. Make another MIDI track and drag **hello-clip** onto it.
2. Switch to Session View (the **Tab** key) and click **Write C-major scale**.
3. **It works if** a new clip appears in the first empty slot on that track. Click that clip, then click **Read selected clip**. A list of notes should appear under **notes**.

This writes to Session View. Chord Fiend will write to Arrangement View instead, and that gets tested in step 3 of the plan.

### hello-state (saves data in the Set)

1. Drag **hello-state** onto an audio track (a new Set already has two). It does not change the sound.
2. Click **Update state** a few times. The number on the button changes. Write down the last number.
3. Save the Set, close it, and open it again.
4. **It works if** the button shows the same number you wrote down.

### hello-window (opens a big window)

1. Drag **hello-window** onto an audio track. It does not change the sound.
2. Click **Open**.
3. **It works if** a window called **My Floating Window** appears. Type something in its box. The same text should appear in the device under **note from window**.
4. Click **Close**. The window should close.
5. Save the Set, close it, open it again, and click **Open**. The text should still be there.

This is the one that matters most for Chord Fiend, because the block editor will live in a window like this.

## 4. Report back

For each device, tell Claude whether it worked or not. If something did not work, these help:

- a screenshot of the device on the track;
- whether **wrapper** in the header showed a dash;
- anything Live showed in a pop-up or in the status bar at the bottom.

## Notes for Claude Code

- Built on Linux from `m4l-jweb` commit `9193a1d3d212d6eec0d7745d05abf569e3c9605b` (v1.6.1, 2026-08-30) plus `patches/m4l-jweb-mac-file-url.patch`, with `pnpm install --frozen-lockfile && pnpm build`. Its own test suite passed (348 tests). The devices are `hello-midi`, `hello-state`, `hello-clip` and `hello-window` from `dist/m4l-jweb/`.
- **The Mac fix.** On macOS `this.patcher.filepath` comes back in Max's form, `Macintosh HD:/Users/...`. Max's `File` accepts that, so the page extracted fine (the `.html` and `.stamp` files were on disk), but the wrapper built `file:///Macintosh%20HD:/Users/...` from it and `[jweb]` showed "Your file couldn't be accessed". Seen in the Max console on the first run: `sent url file:///Macintosh%20HD:/Users/cardinmoffett/Music/Ableton/User%20Library/...`. The patch adds `pageUrl()` in `packages/wrapper/src/core.ts`, which turns `Volume:/rest` into `/rest` on the boot volume (a path into `Users`, `Applications`, `Library` and so on) or `/Volumes/Volume/rest` otherwise. Windows and plain POSIX paths give the same URL as before. It covers the device page and floating windows; `placeUrl()` for `[maxurl]` downloads has the same issue and is not patched, since we do not use downloads. Worth reporting upstream.
- Each `.amxd` is self-contained: the UI rides inside it as a payload and is unpacked next to the device at load. The loose `.html` files and `wrapper.js` in `dist/` are not needed.
- The plan's spike asked about building on the Mac. These were built in the cloud instead, so this tests whether the devices run on the Mac, not whether the build tool does. If we keep building in the cloud, the macOS build question does not need answering.
- `hello-clip` writes with `writeClip`, which fills the first empty Session slot. The Arrangement path (`Track.create_midi_clip`) is not covered here.
- SHA-256 of the four devices:

      7f8ca688ae1759ac41c2b5e2c51a6b39538ffed9ce976b65bab9e2fae2c9a534  hello-clip.amxd
      49e3b90f064137d3de25d33df2435935092d9ff7175af0e7fbee6ad21dcdf02c  hello-midi.amxd
      f9c8762b3d8c0c5dd6e0759f03578bb4f2ad4bf94216a08478e9ae1f352f5486  hello-state.amxd
      0589574a938ff6f255d4566ad876adf046e370d47432e8611cbeaf16fc4f1a01  hello-window.amxd
