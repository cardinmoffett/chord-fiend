// Turns a section (a list of blocks) into three note lists, chords, bass and drums,
// in beats from the start of the section. This is what the device writes into
// Arrangement clips.
//
// It follows how the app plays a section (scheduleOnePass, scheduleBassForBlock and
// playDrumStepAt in original/modal-sketchpad.html), with the audio taken out:
//
//   - Chords: each block's chord is held for the whole block.
//   - Bass: each block restarts the beat's bass lanes at its own start, so the
//     bassline follows the chord. A lane longer than the block is cut off; a block
//     longer than the lane repeats it; a note that would run past the block's end
//     is shortened. Off for a block whose bassToneIndex is -1, or when bassEnabled
//     is false.
//   - Drums: a 16-step grid (4 steps per beat) that starts at the section's first
//     beat and runs through it regardless of the blocks, checking each drum lane at
//     every step, as the app does. Off when the beat is "off".
//
// The app plays the arpeggiator in place of held chords; the device leaves
// arpeggiation to Ableton, so it is not here.

import {
  buildChord, getDurationBeats, activeBeatPattern, laneByVoice, patternHasHitAtStep,
  bassSlotForVoice, chordTonePitch, bassOctaveShift
} from './engine.js';

// General MIDI drum notes, which a default Drum Rack follows.
export var DEFAULT_DRUM_MAP = {kick: 36, snare: 38, hihat: 42};
export var DRUM_VOICES = ['kick', 'snare', 'hihat'];

var DEFAULTS = {
  rootIndex: 0,
  modeIndex: 0,
  drumBeat: 'rock',
  customBeatPatterns: null,
  bassEnabled: true,
  bassWrapLow: 28,
  drumMap: DEFAULT_DRUM_MAP,
  chordVelocity: 96,
  bassVelocity: 100,
  drumVelocity: 100,
  drumHitBeats: 0.25
};

var EPS = 0.0001;

// blocks: the section's blocks. settings: any of DEFAULTS.
// Returns {lengthBeats, blockStarts, chords, bass, drums}; each note is
// {pitch, start, duration, velocity}, sorted by start then pitch.
export function sectionToNotes(blocks, settings) {
  var s = Object.assign({}, DEFAULTS, settings || {});
  var drumMap = Object.assign({}, DEFAULT_DRUM_MAP, s.drumMap || {});
  var chords = [], bass = [], drums = [], blockStarts = [];
  var pattern = s.drumBeat && s.drumBeat !== 'off' ? activeBeatPattern(s.drumBeat, s.customBeatPatterns) : null;
  var bassPattern = activeBeatPattern(s.drumBeat, s.customBeatPatterns);

  var cursor = 0;
  blocks.forEach(function (block) {
    var dur = getDurationBeats(block);
    var chord = buildChord(block, s.rootIndex, s.modeIndex);
    blockStarts.push(cursor);
    chord.pitches.forEach(function (p) {
      chords.push({pitch: p, start: cursor, duration: dur, velocity: s.chordVelocity});
    });

    if (s.bassEnabled && block.bassToneIndex !== -1) {
      var shift = bassOctaveShift(chord.chordRootPitch, s.bassWrapLow);
      bassPattern.lanes.forEach(function (lane) {
        var slot = bassSlotForVoice(lane.voice);
        if (slot < 0) return;
        var pitch = chordTonePitch(chord, slot) + shift;
        for (var cycle = 0; cycle * bassPattern.loopBeats < dur - EPS; cycle++) {
          lane.hits.forEach(function (hit) {
            var startBeat = cycle * bassPattern.loopBeats + hit.beat;
            if (startBeat >= dur - EPS) return;
            bass.push({pitch: pitch, start: cursor + startBeat, duration: Math.min(hit.dur, dur - startBeat), velocity: s.bassVelocity});
          });
        }
      });
    }
    cursor += dur;
  });

  if (pattern) {
    var steps = Math.round(cursor * 4);
    for (var step = 0; step < steps; step++) {
      DRUM_VOICES.forEach(function (voice) {
        if (!patternHasHitAtStep(laneByVoice(pattern, voice), step % 16, 4)) return;
        var start = step / 4;
        drums.push({pitch: drumMap[voice], start: start, duration: Math.min(s.drumHitBeats, cursor - start), velocity: s.drumVelocity});
      });
    }
  }

  function order(a, b) { return a.start - b.start || a.pitch - b.pitch; }
  return {lengthBeats: cursor, blockStarts: blockStarts, chords: chords.sort(order), bass: bass.sort(order), drums: drums.sort(order)};
}
