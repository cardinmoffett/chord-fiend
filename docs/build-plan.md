# Block Editor for Ableton — Build Plan

Oct 4, 2026 · @Cardin

## What we're building

A Max for Live device that opens a large window holding the block editor, and writes the result into Arrangement clips on three tracks. You build sections and put them in order in the window. As you edit, the device writes real notes into clips on a chords track, a bass track and a drums track, each running whatever Ableton instrument you choose.

The window owns the song, and the Arrangement is its output. The window also has play, stop and loop controls that drive Ableton's real transport, so looping a block means setting Live's loop and pressing play.

The aim: visual block editing with the theory engine behind it, one place controlling multi-instrument accompaniment, and Ableton's own audio quality and processing.

## How it's put together

&#91;embedded content: architecture · 4 parts, one direction\]

There are four parts. The chord engine is shared with the mobile app, the editor window is the block editor without the sound, the Max for Live device is the container that hosts the window, and the writer places the notes as clips. The window also drives Ableton's real transport.

## Scope

The device keeps everything that shapes notes and drops everything Ableton already does. Custom rhythm patterns and keyboard trigger mode wait until later.

**In**

- Block editing with all theory settings: degree or applied chord (target and function), extension, mode, sus, aug, inversion, drop, octave, duration and feel
- Key, master mode, and chord names with correct sharps and flats
- Sections, their order, and link/detach between the clips the device placed
- Auto-generated drums and bass: the five built-in beats, bass on/off per block, bass lowest note, and a mapping from drum hits to Drum Rack notes
- Play, stop and loop controls in the window
- Paste a project in from the mobile app, and copy one out

**Out, and why**

- All sound and sound shaping (instruments, volumes, reverb, delay, arpeggiator): Ableton does it
- Tempo: clips are written in beats, so the device never needs the BPM
- Project manager: the Live Set is the project, and each device holds one song
- Phone interface (the draggable drawer, gestures, scroll fixes): replaced by a wide layout
- Learn curriculum: not part of this device
- Color palette picker: one palette ships, and block colors stay
- Rhythm editor (the 16-step grid): later; until then, hand-edit a generated clip in the piano roll and detach it
- Keyboard trigger mode and the instant chord blip: dropped for now, and either can return as an extra mode

## Build order

Seven steps, and two evenings of testing on the Mac decide whether the plan holds. Step 4 does not depend on steps 2 and 3, so it can run alongside them.

1. **Save the work.** Copy the engine and its tests (the chord, spelling, inversion and drop checks) somewhere safe and start a repo. Done when the tests run from the repo.
2. **Mac spike (about an evening).** Build the `m4l-jweb` demo devices (`hello-midi`, `hello-state`, `hello-clip`, `hello-window`) and load them in Live on the Mac. Go if they run. If not, switch to `js2max` or a hand-made shell. The engine is unaffected either way.
3. **Feel tests (about an evening).** Four checks in real Live:
   - The big window feels good to use.
   - The device writes to three tracks and replaces clips cleanly.
   - Looping a block from the window feels immediate, and rewriting notes mid-loop causes no stuck notes.
   - The project survives saving and reopening the Live Set. A bad failure in any of these means rethinking before building more.
4. **Engine extraction.** Pass key and mode in as parameters instead of reading app-wide state, then run the engine tests against the package.
5. **Editor in the window.** Lift the UI out of the single app file and build blocks, sections, the wide layout and the transport controls.
6. **Writer.** Sections to clips, the placement list, hand-edit protection, link/detach, drum note mapping and track pickers.
7. **Paste-in from the mobile app.**

## Open decisions

Six questions stay open and get settled during the spike, not before.

- **UI framework.** The mobile app is plain JavaScript, and `m4l-jweb`'s helpers for state saving and windows are written for React. Check whether the plain-JavaScript UI can use the underlying bridge directly, or whether the UI moves to React.
- **Where clips start.** The playhead, the loop start, or a fixed bar on the Arrangement timeline.
- **How the three target tracks are chosen.** Pickers in the window, or the device creates the tracks itself.
- **Which track hosts the device, and as which device type.** A MIDI effect on the chords track is the current lean.
- **How the writer recognizes its own clips** if you move, rename or duplicate them. First idea: a name tag plus a saved list of what it placed.
- **What happens to a hand-edited clip.** Current plan: mark it and ask before overwriting, with a per-track lock.

## Risks and what's verified

The Live API facts below come from documentation, and none of this has been run on your Mac yet. The real unknowns are how it feels and whether the build tool works on macOS.

| Claim | Status |
| --- | --- |
| Live 12.2+ bundles Max 9, with the modern `v8` JavaScript engine | Documented ([VSTOPIA JS-Live-API](https://vstopia.github.io/JS-Live-API/)) |
| The device strip is a fixed 169 px tall | Documented ([Cycling '74](https://docs.cycling74.com/userguide/m4l/live_userinterfaces/)) |
| A device can create Arrangement MIDI clips on any track (`Track.create_midi_clip`, Live 12.1.10 and later) | Documented ([Ableton release notes](https://www.ableton.com/en/release-notes/live-12/)); you have 12.2+ |
| Ableton fixed a crash in that call | Documented in the same notes; the exact version is not identified, so keep Live updated |
| A device can set the loop, move the playhead, start playback and reset Back to Arrangement | Documented ([Live Object Model, Song](https://docs.cycling74.com/apiref/lom/song/)) |
| `jweb~` runs on Chromium on both Mac and Windows | Documented ([Cycling '74](https://docs.cycling74.com/reference/jweb~)) |
| `jweb` cannot load an HTML file from inside a frozen device | Reported by a [third-party project](https://github.com/h1data/M4L-jweb-injection); `m4l-jweb` works around it by unpacking its UI to a file at load |
| `m4l-jweb` builds devices without the Max editor, saves state in the Live Set, and opens floating windows | Claimed in its [README](https://github.com/alienmind/m4l-jweb); not run by us |
| `m4l-jweb` works on macOS | Unverified: its author tested on Windows, and a Mac installer script exists |
| Playhead jumps are immediate, and rewriting notes mid-loop is clean | Unverified: step 3 |
| Chords survive saving and reopening the Live Set | Unverified: step 3 |
| Pasting text into the editor window works inside a device | Unverified |

Two likely trouble spots, both guesses: file paths on the Mac, since `m4l-jweb` unpacks its UI to a file at load, and the React assumption in its helpers. If the tool fails on the Mac, `js2max` is the fallback, and the chord engine does not change.

## Technical appendix for Claude Code

This appendix records what the code scan and the documentation established, so the next session does not have to rediscover it.

### Stack

- Runtime: Max for Live on Live 12.2+ (Max 9), macOS.
- Build tool candidate: `m4l-jweb` (MIT, TypeScript). It generates the patcher, writes the `.amxd` without Max, hosts the UI in `jweb`, saves state in the Live Set, opens floating windows, and offers a mocked Live for browser development. Scaffold with `pnpm dlx @m4l-jweb/build init my-device`. Its `[js]` glue compiles to ES5, and the build checks that.
- Fallback: `js2max`, which compiles a Max 9 `v8` JavaScript file into an `.amxd`.
- The current UI is one HTML file of plain JavaScript, with Tone.js for sound. Tone.js does not carry over.

### Engine extraction (measured on the single-file app)

- `buildChord(block, rootIndex, modeIndex)` calls only `applyDrops`, `buildExtendedScale`, `chordToneLabel` and `chordToneRoles`. None of them touch app state, the DOM, audio or storage.
- It uses 18 plain constants: `BLOCK_MODE_NAMES`, `CHORD_DEGREE_REFERENCE`, `DEGREE_INDEX`, `DEGREE_NAMES`, `DIMINISHED7_INTERVALS`, `DOMINANT_INTERVALS`, `DROP_NAMES`, `EXTENSION_NAMES`, `EXTENSION_TONE_COUNT`, `FLAT_PREFERRING_MAJOR_ROOT`, `MASTER_MODE_NAMES`, `MASTER_MODE_RELATIVE_MAJOR_OFFSET`, `MODES`, `NOTE_NAMES`, `NOTE_NAMES_FLAT`, `NOTE_NAME_TO_OFFSET`, `STACKED_THIRD_ROLES`, `SUS_NAMES`.
- The one `state` read on the chord path is in `getChordSymbol` (`state.masterRootIndex`, for sharp/flat spelling). Other readers: `appliedFunctionLabel` (`masterModeIndex`), `bassOctaveShift` and `computeBassPitchForBlock` (bass lowest note, drum beat). `blockHSL` (UI color) and `describeProgression` (Learn) stay behind.
- The fix is to take key, mode, bass lowest note and beat as parameters.

### New work in the writer

- Drum and bass patterns are plain data: `BUILTIN_BEAT_PATTERNS`, each `{label, loopBeats, lanes:[{voice, hits:[{beat, dur}]}]}`, with voices `kick`, `snare`, `hihat`, `bass1`, `bass3`, `bass5` and `bass7`.
- The functions that play them (`scheduleBassForBlock`, `playDrumStepAt`) are tied to the audio engine and do not carry over. A pure function from a section (blocks, pattern, settings) to three note lists (chords, bass, drums) is new work. It can reuse `chordTonePitch`, `bassOctaveShift` and `computeBassPitchForBlock` once they take parameters.
- Drum hits need a mapping to Drum Rack notes. General MIDI numbers (36 kick, 38 snare, 42 hi-hat) are a reasonable default, to be confirmed against the actual rack.

### Live API surface (documented; see Risks)

- Create clips with `Track.create_midi_clip` (Live 12.1.10+). It reportedly returns nothing before 12.2. If no clip comes back, find it in the track's `arrangement_clips` by start time.
- Write notes with `Clip.add_new_notes` and a `notes` list (`pitch`, `start_time`, `duration`, `velocity`, optional `mute`). Read and clear with `get_notes_extended` and `remove_notes_extended`, as the old plugin did.
- Arrangement clips live under the track's `arrangement_clips`, not `clip_slots`. The old plugin learned this the hard way.
- Transport: Song `loop`, `loop_start`, `loop_length` (in beats), `current_song_time` (readable, settable, observable), `start_playing` and `back_to_arranger`. Observe `current_song_time` to highlight the playing block.
- Save the user's own loop settings before any preview and restore them after.

### Tests to carry over

- Carry: `test_applied`, `test_enharmonic2`, `test_minorlabel`, `test_extension_fix`, `test_inversion_labels` and `test_drops` (70,560 inversion and drop combinations checked against the textbook definition).
- Leave behind: the lesson, gesture, scroll, audio and settings tests.
- They load the app's script into Node with a mock DOM and a mock Tone, so they need re-pointing at the package. They currently exist only in the web-app session's working folder, so step 1 must export them.

### Sources

Opened in full: the `m4l-jweb` [README](https://github.com/alienmind/m4l-jweb). Seen in search results only, not opened in full: [VSTOPIA JS-Live-API](https://github.com/VSTOPIA/JS-Live-API), [js2max](https://github.com/ktamas77/js2max/), [Live 12 release notes](https://www.ableton.com/en/release-notes/live-12/), [Cycling '74 Live Object Model, Song](https://docs.cycling74.com/apiref/lom/song/), [Live Object Model, Clip](https://docs.cycling74.com/apiref/lom/clip/), [jweb\~ reference](https://docs.cycling74.com/reference/jweb~), [M4L-jweb-injection](https://github.com/h1data/M4L-jweb-injection), and a [developer note on create\_midi\_clip](https://github.com/Samtong/ableton-mcp-pro/pull/7).
