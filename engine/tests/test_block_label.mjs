// Block labels: the large degree-and-formula label and the small chord name each block
// shows. Expected labels are written from music theory (roman numerals in the key), not
// copied from the code.
import { defaultBlock, blockLabel } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
function lbl(o, root, mode) { return blockLabel(Object.assign(defaultBlock(), o), root || 0, mode || 0); }
var F = '♭', S = '♯', DIM = '°';

console.log('=== diatonic: the numeral, then the formula ===');
check('I in C', lbl({}), {degree: 'I', name: 'C'});
check('V7 in C is G7', lbl({degreeIndex: 4, extensionIndex: 2}), {degree: 'V7', name: 'G7'});
check('ii7 in C is Dm7', lbl({degreeIndex: 1, extensionIndex: 2}), {degree: 'ii7', name: 'Dm7'});
check('vi in C is Am', lbl({degreeIndex: 5}), {degree: 'vi', name: 'Am'});
check('IVsus2 in C', lbl({degreeIndex: 3, susIndex: 1}).degree, 'IVsus2');
check('i in A minor (Aeolian) is Am', lbl({}, 9, 5), {degree: 'i', name: 'Am'});
check('vii' + DIM + ' in C stays vii' + DIM + ' (no second flat five)', lbl({degreeIndex: 6, flat5: 1}).degree, 'vii' + DIM);

console.log('=== a stacked 7th names its kind ===');
check('Imaj7 in C (C E G B)', lbl({extensionIndex: 2}), {degree: 'Imaj7', name: 'Cmaj7'});
check('IVmaj7 in C, not IV7 (F A C E)', lbl({degreeIndex: 3, extensionIndex: 2}), {degree: 'IVmaj7', name: 'Fmaj7'});
check('IVmaj9 in C', lbl({degreeIndex: 3, extensionIndex: 3}).degree, 'IVmaj9');
check('IV7 borrowed from Dorian is the dominant F7 (F A C Eb)', lbl({degreeIndex: 3, blockModeIndex: 2, extensionIndex: 2}), {degree: 'IV7', name: 'F7'});
check('vii half-diminished 7 in C reads vii\u00F87 (B D F A)', lbl({degreeIndex: 6, extensionIndex: 2}), {degree: 'vii\u00F87', name: 'Bm7b5'});
check('i(maj7) borrowed from harmonic minor (C Eb G B)', lbl({degreeIndex: 0, blockModeIndex: 8, extensionIndex: 2}), {degree: 'i(maj7)', name: 'Cm(maj7)'});
check('vii\u00B07 in harmonic minor stays vii\u00B07 (B D F Ab)', lbl({degreeIndex: 6, blockModeIndex: 8, extensionIndex: 2}).degree, 'vii\u00B07');

console.log('=== borrowed: the numeral in the borrowed mode ===');
check(F + 'VI borrowed from Aeolian, in C, is A' + F, lbl({degreeIndex: 5, blockModeIndex: 6}), {degree: F + 'VI', name: 'A' + F});
check(F + 'VII borrowed from Mixolydian, in C, is B' + F, lbl({degreeIndex: 6, blockModeIndex: 5}), {degree: F + 'VII', name: 'B' + F});
check('iv borrowed from Aeolian, in C, is Fm', lbl({degreeIndex: 3, blockModeIndex: 6}), {degree: 'iv', name: 'Fm'});

console.log('=== applied: function / target ===');
check('V/ii in C is A', lbl({chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'dominant'}), {degree: 'V/ii', name: 'A'});
check('V7/V in C is D7', lbl({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 2}), {degree: 'V7/V', name: 'D7'});
check('vii' + DIM + '7/V in C (leading-tone into G) is F' + S + 'dim7', lbl({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'leadingTone'}).degree, 'vii' + DIM + '7/V');

console.log('=== the fifth ===');
check('applied V/I augmented reads V+/I', lbl({chordSource: 'applied', appliedTargetIndex: 0, appliedFunction: 'dominant', aug: 1}).degree, 'V+/I');
check('applied V7/I with a flat 5 reads V7' + F + '5/I', lbl({chordSource: 'applied', appliedTargetIndex: 0, appliedFunction: 'dominant', extensionIndex: 2, flat5: 1}).degree, 'V7' + F + '5/I');
check('free G augmented reads G+', lbl({chordSource: 'free', freeRoot: 7, freeQuality: 'augmented'}).degree, 'G+');
check('a diatonic V ignores aug (on the rails): plain V', lbl({degreeIndex: 4, aug: 1}), {degree: 'V', name: 'G'});

console.log('=== free: root and quality, since it has no degree in the key ===');
check('free E major in C', lbl({chordSource: 'free', freeRoot: 4, freeQuality: 'major'}).degree, 'E');
check('free F minor 7 in C', lbl({chordSource: 'free', freeRoot: 5, freeQuality: 'minor', extensionIndex: 2}).degree, 'Fm7');
check('free C major 7 in C', lbl({chordSource: 'free', freeRoot: 0, freeQuality: 'major', extensionIndex: 2}).degree, 'Cmaj7');
check('free G dominant 7 in C', lbl({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: 2}).degree, 'G7');
check('free G dominant 9 in C', lbl({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: 3}).degree, 'G9');
check('free G dominant with no 7th sounds as G major, so reads G', lbl({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant'}), {degree: 'G', name: 'G'});
check('free B' + F + ' in F spells with a flat', lbl({chordSource: 'free', freeRoot: 10, freeQuality: 'major'}, 5).degree, 'B' + F);
check('free F' + S + ' minor in D spells with a sharp', lbl({chordSource: 'free', freeRoot: 6, freeQuality: 'minor'}, 2).degree, 'F' + S + 'm');

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
