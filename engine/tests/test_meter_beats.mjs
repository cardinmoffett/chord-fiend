// 3/4 beats: each built-in beat's loopBeats is its meter; the 3/4 ones put the kick on
// beat 1 only and loop every 3 beats, and the device's note generator loops them that way.
import { BUILTIN_BEAT_PATTERNS, beatPatternsForMeter, defaultBeatForMeter, laneByVoice, patternHasHitAtStep, defaultBlock } from '../src/engine.js';
import { sectionToNotes } from '../src/notes.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
check('4/4 beats', beatPatternsForMeter(4), ['rock', 'fourfloor', 'hiphop', 'halftime', 'latin']);
check('3/4 beats', beatPatternsForMeter(3), ['waltz', 'jazzwaltz', 'ballad34']);
check('each meter starts on its own beat', [defaultBeatForMeter(4), defaultBeatForMeter(3)], ['rock', 'waltz']);
beatPatternsForMeter(3).forEach(function (k) {
  var p = BUILTIN_BEAT_PATTERNS[k];
  var kicks = [];
  for (var st = 0; st < 12; st++) if (patternHasHitAtStep(laneByVoice(p, 'kick'), st, 4)) kicks.push(st);
  check(p.label + ': kick on beat 1 only', kicks, [0]);
  check(p.label + ': every hit falls inside the 3-beat bar', p.lanes.every(function (l) { return l.hits.every(function (h) { return h.beat >= 0 && h.beat + h.dur <= 3 + 1e-9; }); }), true);
});
// Two bars of 3/4 (two dotted halves) with the waltz: kicks at beats 0 and 3.
var bar = Object.assign(defaultBlock(), {durationIndex: 3, durationModifier: 1});
var notes = sectionToNotes([bar, Object.assign({}, bar)], {drumBeat: 'waltz', drumMap: {kick: 36, snare: 38, hihat: 42}});
check('device notes: the waltz kick lands on beats 0 and 3 of two 3/4 bars', notes.drums.filter(function (n) { return n.pitch === 36; }).map(function (n) { return n.start; }), [0, 3]);
check('...and the rock kick still loops every 4 beats', sectionToNotes([Object.assign(defaultBlock(), {durationIndex: 1})], {drumBeat: 'rock', drumMap: {kick: 36, snare: 38, hihat: 42}}).drums.filter(function (n) { return n.pitch === 36; }).map(function (n) { return n.start; }), [0, 2, 4, 6]);

if (!ok) { console.log('\nSOME FAILED'); process.exit(1); }
console.log('\nALL PASSED');
