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

console.log('=== free: the root is a step from the key, so it still reads as a number ===');
check('free III (E major) in C', lbl({chordSource: 'free', freeRoot: 4, seventh: 'maj'}), {degree: 'III', name: 'E'});
check('free iv7 (F minor 7) in C', lbl({chordSource: 'free', freeRoot: 5, third: 'minor', extensionIndex: 2}), {degree: 'iv7', name: 'Fm7'});
check('free Imaj7 in C', lbl({chordSource: 'free', freeRoot: 0, seventh: 'maj', extensionIndex: 2}).degree, 'Imaj7');
check('free V7 (dominant) in C', lbl({chordSource: 'free', freeRoot: 7, extensionIndex: 2}).degree, 'V7');
check('free V9 in C', lbl({chordSource: 'free', freeRoot: 7, extensionIndex: 3}).degree, 'V9');
check('free dominant with no 7th is a major triad: V', lbl({chordSource: 'free', freeRoot: 7}), {degree: 'V', name: 'G'});
check('free ' + F + 'VI in C is A' + F + ' major, spelled with a flat', lbl({chordSource: 'free', freeRoot: 8, seventh: 'maj'}), {degree: F + 'VI', name: 'A' + F});
check('free ' + F + 'III in C is E' + F + ' (not D#)', lbl({chordSource: 'free', freeRoot: 3, seventh: 'maj'}), {degree: F + 'III', name: 'E' + F});
check('free ' + S + 'IV in C is F#', lbl({chordSource: 'free', freeRoot: 6, seventh: 'maj'}).name, 'F#');
check('free ' + F + 'II in C (D' + F + ' major, the Neapolitan)', lbl({chordSource: 'free', freeRoot: 1, seventh: 'maj'}).degree, F + 'II');
check('free ' + S + 'iv' + '° in C (F' + S + ' diminished)', lbl({chordSource: 'free', freeRoot: 6, third: 'minor', fifth: 'b5', seventh: 'dim'}).degree, S + 'iv°');
check('free diminished 7 a half step above C is ' + S + 'i°7, C#dim7 (not ' + F + 'ii)', lbl({chordSource: 'free', freeRoot: 1, third: 'minor', fifth: 'b5', seventh: 'dim', extensionIndex: 2}), {degree: S + 'i°7', name: 'C#dim7'});
check('free diminished on ' + S + 'V: ' + S + 'v° (G#dim)', lbl({chordSource: 'free', freeRoot: 8, third: 'minor', fifth: 'b5', seventh: 'dim'}), {degree: S + 'v°', name: 'G#dim'});
check('the step moves with the key: free III in F is A major', lbl({chordSource: 'free', freeRoot: 4, seventh: 'maj'}, 5), {degree: 'III', name: 'A'});
check('free V+ (augmented) in C', lbl({chordSource: 'free', freeRoot: 7, fifth: '#5'}).degree, 'V+');

console.log('=== alter: any chord can step off the key, and its number says so ===');
check('ii with a major 3rd and a flat 7th reads II7 (D F# A C)', lbl({degreeIndex: 1, extensionIndex: 2, third: 'major', seventh: 'min'}), {degree: 'II7', name: 'D7'});
check('vi with a major 3rd reads VI (A C# E)', lbl({degreeIndex: 5, third: 'major'}), {degree: 'VI', name: 'A'});
check('I with a flat 7th reads I7 (C E G Bb)', lbl({extensionIndex: 2, seventh: 'min'}), {degree: 'I7', name: 'C7'});
check('vi7 with a major 7th reads vi(maj7)', lbl({degreeIndex: 5, extensionIndex: 2, seventh: 'maj'}), {degree: 'vi(maj7)', name: 'Am(maj7)'});
check('V with a raised 5th reads V+ (G B D#)', lbl({degreeIndex: 4, aug: 1}), {degree: 'V+', name: 'Gaug'});
check('V7 with a flat 5th reads V7' + F + '5', lbl({degreeIndex: 4, extensionIndex: 2, flat5: 1}), {degree: 'V7' + F + '5', name: 'G7b5'});
check('V9 with a flat 9 reads V7(' + F + '9)', lbl({degreeIndex: 4, extensionIndex: 3, ninth: 'b9'}), {degree: 'V7(' + F + '9)', name: 'G7(b9)'});
check('IV7 from the key is IVmaj7; with a flat 7th it reads IV7', lbl({degreeIndex: 3, extensionIndex: 2, seventh: 'min'}), {degree: 'IV7', name: 'F7'});
check('vii with a perfect 5th (fifth: 5) reads vii (B D F#, Bm)', lbl({degreeIndex: 6, fifth: '5'}), {degree: 'vii', name: 'Bm'});
check('fifth #5 on V reads V+ (Gaug)', lbl({degreeIndex: 4, fifth: '#5'}), {degree: 'V+', name: 'Gaug'});
check('fifth b5 on V7 reads V7' + F + '5', lbl({degreeIndex: 4, extensionIndex: 2, fifth: 'b5'}), {degree: 'V7' + F + '5', name: 'G7b5'});
check('a sus chord ignores a 3rd it does not have', lbl({degreeIndex: 4, susIndex: 2, third: 'minor'}).degree, 'Vsus4');

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
