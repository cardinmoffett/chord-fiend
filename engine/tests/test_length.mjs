// Length: a base note (quarter, half, whole) and one modifier (a feel or a multiplier).
// Expected beats are written from theory, counting a quarter note as one beat.
import { defaultBlock, getDurationBeats, lengthParts, lengthChange } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
function beats(base, mod) { return getDurationBeats(Object.assign(defaultBlock(), lengthChange(base, mod))); }
function parts(o) { return lengthParts(Object.assign(defaultBlock(), o)); }

console.log('=== beats for each base and modifier ===');
check('quarter, half, whole: 1, 2, 4 beats', [beats('quarter', 'straight'), beats('half', 'straight'), beats('whole', 'straight')], [1, 2, 4]);
check('dotted half = 3 beats, dotted whole = 6', [beats('half', 'dotted'), beats('whole', 'dotted')], [3, 6]);
check('triplet half = 2 x 2/3 = 4/3 beats', beats('half', 'triplet'), 4 / 3);
check('whole x2 = 2 bars (8 beats), x3 = 12, x4 = 16', [beats('whole', 'x2'), beats('whole', 'x3'), beats('whole', 'x4')], [8, 12, 16]);
check('quarter x3 = 3 beats (the same as a dotted half)', beats('quarter', 'x3'), 3);
check('quarter x1/2 = an 8th, x1/4 = a 16th', [beats('quarter', 'x1/2'), beats('quarter', 'x1/4')], [0.5, 0.25]);

console.log('=== reading a block back ===');
check('the default block is a whole note, straight', parts({}), {base: 'whole', mod: 'straight'});
check('every base and modifier reads back as set', ['quarter', 'half', 'whole'].every(function (b) {
  return ['straight', 'dotted', 'triplet', 'x2', 'x3', 'x4', 'x1/2', 'x1/4'].every(function (m) {
    var p = lengthParts(Object.assign(defaultBlock(), lengthChange(b, m)));
    return p.base === b && p.mod === m;
  });
}), true);
check('a stored 4 bars reads as whole x4', parts({durationIndex: 0}), {base: 'whole', mod: 'x4'});
check('a stored 2 bars reads as whole x2', parts({durationIndex: 1}), {base: 'whole', mod: 'x2'});
check('a stored 8th reads as quarter x1/2, a 16th as quarter x1/4', [parts({durationIndex: 5}), parts({durationIndex: 6})], [{base: 'quarter', mod: 'x1/2'}, {base: 'quarter', mod: 'x1/4'}]);
check('a stored dotted half reads as half, dotted', parts({durationIndex: 3, durationModifier: 1}), {base: 'half', mod: 'dotted'});
check('picking a feel clears a multiplier', lengthChange('half', 'dotted'), {durationIndex: 3, durationModifier: 1, durationMult: 1});

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
