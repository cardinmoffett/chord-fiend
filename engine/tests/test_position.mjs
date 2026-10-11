// Position: inversion and octave as one control that rotates the chord a note at a time.
// Expected notes are written from theory: each step up moves the lowest note to the top.
import { defaultBlock, buildChord, positionStep, positionLabel } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
function blk(o) { return Object.assign(defaultBlock(), o); }
// Walk n steps from a block, returning each step's pitches.
function walk(b, dir, n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    var next = positionStep(b, buildChord(b, 0, 0), dir);
    if (!next) { out.push(null); break; }
    b = Object.assign({}, b, next);
    out.push(buildChord(b, 0, 0).pitches);
  }
  return out;
}

console.log('=== up: the lowest note moves to the top ===');
// C major from C4 (60 64 67): E G C, G C E, then C E G an octave up.
check('C triad, three steps up', walk(blk({}), 1, 3), [[64, 67, 72], [67, 72, 76], [72, 76, 79]]);
check('...the third step is root position, octave +1', positionStep(blk({inversion: 2}), buildChord(blk({inversion: 2}), 0, 0), 1), {inversion: 0, octave: 1});

console.log('=== down: the top note moves to the bottom ===');
// From C4 root position: G below (G3 C4 E4), then E3 G3 C4, then C3 E3 G3.
check('C triad, three steps down', walk(blk({}), -1, 3), [[55, 60, 64], [52, 55, 60], [48, 52, 55]]);
check('...the first step is 2nd inversion, octave -1', positionStep(blk({}), buildChord(blk({}), 0, 0), -1), {inversion: 2, octave: -1});

console.log('=== a 7th chord has four positions per octave ===');
// G7 (V7 in C) from G4: B D F G, D F G B, F G B D, G B D F.
check('G7, four steps up', walk(blk({degreeIndex: 4, extensionIndex: 2}), 1, 4), [[71, 74, 77, 79], [74, 77, 79, 83], [77, 79, 83, 86], [79, 83, 86, 89]]);

console.log('=== limits and labels ===');
check('no step past octave +3', positionStep(blk({octave: 3, inversion: 2}), buildChord(blk({octave: 3, inversion: 2}), 0, 0), 1), null);
check('no step below octave -3', positionStep(blk({octave: -3}), buildChord(blk({octave: -3}), 0, 0), -1), null);
check('label: the bass tone', positionLabel(blk({inversion: 1}), buildChord(blk({inversion: 1}), 0, 0)), '3');
check('label: with the octave when it is not 0', positionLabel(blk({degreeIndex: 4, extensionIndex: 2, inversion: 3, octave: 1}), buildChord(blk({degreeIndex: 4, extensionIndex: 2, inversion: 3, octave: 1}), 0, 0)), '♭7 +1');
check('label: a negative octave', positionLabel(blk({inversion: 2, octave: -1}), buildChord(blk({inversion: 2, octave: -1}), 0, 0)), '5 −1');
check('a stored inversion past the chord\'s tones steps from the real one', positionStep(blk({inversion: 6}), buildChord(blk({inversion: 6}), 0, 0), 1), {inversion: 0, octave: 1});

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
