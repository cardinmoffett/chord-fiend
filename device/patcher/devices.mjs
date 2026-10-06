/**
 * devices.mjs - the device manifest. The patcher is generated from it.
 *
 * chord-fiend-test is a MIDI effect for the chords track. The generated patcher keeps
 * its direct midiin -> midiout cord, so the chord clip on this track still reaches the
 * instrument after it. The `midiout` chain adds the device's own notes to that output:
 * a chord tapped in the window is heard through the track's instrument. Everything
 * else is LiveAPI in wrapper/device.ts; the window's messages reach [js] through `unmatchedTo`.
 */
export default [
  {
    name: "chord-fiend-test",
    type: "midi",
    chains: ["midiout"],
    unmatchedTo: "js",
  },
];
