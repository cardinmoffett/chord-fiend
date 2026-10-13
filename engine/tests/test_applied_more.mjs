// The newer applied chords: Applied ii, Backdoor, Common-tone diminished and the chromatic
// mediants. Expected chords are written from music theory, not copied from the code.
import { defaultBlock, blockLabel, buildChord, getChordSymbol, appliedFunctionLabel, appliedColorDegrees, alterRows, APPLIED_FUNCTIONS } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
var F = '♭', S = '♯', DIM = '°';
function blk(o) { return Object.assign(defaultBlock(), {chordSource: 'applied'}, o); }
function lbl(o, root, mode) { return blockLabel(blk(o), root || 0, mode || 0); }
// Pitch classes from the root up, sharps as numbers (0 = C).
function pcs(o, root, mode) { var c = buildChord(blk(o), root || 0, mode || 0); return c.offsets.map(function (x) { return (c.chordRootPitch + x) % 12; }); }

console.log('=== the dropdown order ===');
check('functions', APPLIED_FUNCTIONS, ['dominant', 'supertonic', 'tritoneSub', 'backdoor', 'leadingTone', 'commonTone', 'mediant']);

console.log('=== Applied ii: the minor chord a whole step above the target ===');
check('ii/V in C is Am (A C E)', [lbl({appliedFunction: 'supertonic', appliedTargetIndex: 4}), pcs({appliedFunction: 'supertonic', appliedTargetIndex: 4})], [{degree: 'ii/V', name: 'Am'}, [9, 0, 4]]);
check('ii7/V in C is Am7 (A C E G)', [lbl({appliedFunction: 'supertonic', appliedTargetIndex: 4, extensionIndex: 2}), pcs({appliedFunction: 'supertonic', appliedTargetIndex: 4, extensionIndex: 2})], [{degree: 'ii7/V', name: 'Am7'}, [9, 0, 4, 7]]);
check('ii7/vi in C is Bm7', lbl({appliedFunction: 'supertonic', appliedTargetIndex: 5, extensionIndex: 2}).name, 'Bm7');
check('ii/IV in C is Gm', lbl({appliedFunction: 'supertonic', appliedTargetIndex: 3}).name, 'Gm');
check('label', appliedFunctionLabel(blk({appliedFunction: 'supertonic', appliedTargetIndex: 4}), 0), 'ii of V');

console.log('=== Backdoor: the dominant 7th a whole step below the target ===');
check('bVII7/I in C is Bb7 (Bb D F Ab)', [lbl({appliedFunction: 'backdoor', extensionIndex: 2}), pcs({appliedFunction: 'backdoor', extensionIndex: 2})], [{degree: F + 'VII7/I', name: 'B' + F + '7'}, [10, 2, 5, 8]]);
check('bVII7/I in G is F7 (flats, not E#)', lbl({appliedFunction: 'backdoor', extensionIndex: 2}, 7).name, 'F7');
check('bVII/IV in C is Eb', lbl({appliedFunction: 'backdoor', appliedTargetIndex: 3}).name, 'E' + F);

console.log('=== Common-tone diminished: a dim7 on the target\'s root ===');
check('ct°7/I in C is C°7 (C Eb Gb A)', [lbl({appliedFunction: 'commonTone'}).degree, pcs({appliedFunction: 'commonTone'})], ['ct' + DIM + '7/I', [0, 3, 6, 9]]);
check('ct°7/V in C has G in it', pcs({appliedFunction: 'commonTone', appliedTargetIndex: 4}).indexOf(7) >= 0, true);
check('Shape doesn\'t change it (a 13 is still the dim7)', pcs({appliedFunction: 'commonTone', extensionIndex: 5}), [0, 3, 6, 9]);
check('the older aug doesn\'t apply', pcs({appliedFunction: 'commonTone', aug: 1}), [0, 3, 6, 9]);
check('it has 3rd, 5th and 7th rows like the leading-tone chord', alterRows(blk({appliedFunction: 'commonTone'}), 0, 0).filter(function (r) { return !r.disabled; }).map(function (r) { return r.field; }),
  alterRows(blk({appliedFunction: 'leadingTone'}), 0, 0).filter(function (r) { return !r.disabled; }).map(function (r) { return r.field; }));

console.log('=== Mediants: major or minor, a 3rd from the key\'s root ===');
var want = [[F + 'III', 'E' + F, [3, 7, 10]], ['III', 'E', [4, 8, 11]], [F + 'VI', 'A' + F, [8, 0, 3]], ['VI', 'A', [9, 1, 4]],
  [F + 'iii', 'E' + F + 'm', [3, 6, 10]], [F + 'vi', 'A' + F + 'm', [8, 11, 3]]];
want.forEach(function (w, i) {
  check(w[0] + ' in C is ' + w[1], [lbl({appliedFunction: 'mediant', appliedTargetIndex: i}), pcs({appliedFunction: 'mediant', appliedTargetIndex: i})], [{degree: w[0], name: w[1]}, w[2]]);
});
check('with a 7th, the major ones are maj7: bVImaj7 is Abmaj7', lbl({appliedFunction: 'mediant', appliedTargetIndex: 2, extensionIndex: 2}), {degree: F + 'VImaj7', name: 'A' + F + 'maj7'});
check('...and the minor ones m7: biii7 is Ebm7', lbl({appliedFunction: 'mediant', appliedTargetIndex: 4, extensionIndex: 2}), {degree: F + 'iii7', name: 'E' + F + 'm7'});
check('they follow the key: III in G is B', lbl({appliedFunction: 'mediant', appliedTargetIndex: 1}, 7).name, 'B');
check('...but not the mode: bVI in C minor is still Ab', lbl({appliedFunction: 'mediant', appliedTargetIndex: 2}, 0, 5).name, 'A' + F);
check('label', appliedFunctionLabel(blk({appliedFunction: 'mediant', appliedTargetIndex: 2}), 0), 'Mediant ' + F + 'VI');
check('a target index past the six reads as the last', lbl({appliedFunction: 'mediant', appliedTargetIndex: 6}).degree, F + 'vi');
check('colors: bIII sits between ii and iii, III on iii', [appliedColorDegrees(blk({appliedFunction: 'mediant', appliedTargetIndex: 0})), appliedColorDegrees(blk({appliedFunction: 'mediant', appliedTargetIndex: 1}))], [[1, 2], [2]]);
check('other functions take the target\'s color', appliedColorDegrees(blk({appliedFunction: 'backdoor', appliedTargetIndex: 3})), [3]);
check('Alter works on a mediant: III with a minor 3rd', pcs({appliedFunction: 'mediant', appliedTargetIndex: 1, third: 'minor'}), [4, 7, 11]);

if (!ok) { console.log('\nSOME FAILED'); process.exit(1); }
console.log('\nALL PASSED');
