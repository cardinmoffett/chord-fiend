/**
 * devices.mjs - the device manifest. The patcher is generated from it.
 *
 * chord-fiend-test is a MIDI effect for the chords track. No chains: the generated
 * patcher keeps its direct midiin -> midiout cord, so the chord clip on this track
 * still reaches the instrument after it. The window does all the work, through
 * LiveAPI in wrapper/device.ts; its messages reach [js] through `unmatchedTo`.
 */
export default [
  {
    name: "chord-fiend-test",
    type: "midi",
    chains: [],
    unmatchedTo: "js",
  },
];
