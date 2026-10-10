// Shapes (add9, 6/9) and tensions (b9, #9, #11, b13), and the free qualities augmented
// and half-diminished. Expected notes are written from theory, not from the code.
import { defaultBlock, buildChord, getChordSymbol, blockLabel, chordTonePitch, EXTENSION_NAMES, SHAPE_ORDER } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
var PC = {C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11};
var F = '♭', S = '♯';
function pcs(names) { return names.split(' ').map(function (n) { return PC[n]; }); }
function blk(o) { return Object.assign(defaultBlock(), o); }
function chord(o, root, mode) { return buildChord(blk(o), root || 0, mode || 0); }
function rootOrder(c) { return c.offsets.map(function (o) { return ((c.chordRootPitch + o) % 12 + 12) % 12; }); }
function sym(o, root, mode) { return getChordSymbol(chord(o, root, mode), root || 0); }
function label(o, root, mode) { return blockLabel(blk(o), root || 0, mode || 0); }
var SHAPE = {}; EXTENSION_NAMES.forEach(function (n, i) { SHAPE[n] = i; });
var AEOLIAN = 5, BLOCK_AEOLIAN = 6;

console.log('=== the shape list ===');
check('editors show Triad, add9, 6, 6/9, 7, 9, 11, 13', SHAPE_ORDER.map(function (i) { return EXTENSION_NAMES[i]; }), ['triad', 'add9', '6', '6/9', '7', '9', '11', '13']);

console.log('=== add9 and 6/9: the scale\'s own 9th, no 7th ===');
check('I add9 in C: C E G D, Cadd9, label Iadd9', [rootOrder(chord({extensionIndex: SHAPE.add9})), sym({extensionIndex: SHAPE.add9}), label({extensionIndex: SHAPE.add9}).degree], [pcs('C E G D'), 'Cadd9', 'Iadd9']);
check('the 9th sits above the octave (D5, not D4)', chord({extensionIndex: SHAPE.add9}).pitches, [60, 64, 67, 74]);
check('ii add9 in C: D F A E, named Dmadd9', [rootOrder(chord({degreeIndex: 1, extensionIndex: SHAPE.add9})), sym({degreeIndex: 1, extensionIndex: SHAPE.add9})], [pcs('D F A E'), 'Dmadd9']);
check('I 6/9 in C: C E G A D, C6/9, label I6/9', [rootOrder(chord({extensionIndex: SHAPE['6/9']})), sym({extensionIndex: SHAPE['6/9']}), label({extensionIndex: SHAPE['6/9']}).degree], [pcs('C E G A D'), 'C6/9', 'I6/9']);
check('iv borrowed from Aeolian, add9: F Ab C G (the borrowed scale\'s 9th)', rootOrder(chord({degreeIndex: 3, blockModeIndex: BLOCK_AEOLIAN, extensionIndex: SHAPE.add9})), pcs('F Ab C G'));
check('applied V of V, add9: D F# A E', rootOrder(chord({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: SHAPE.add9})), pcs('D F# A E'));
check('free E minor add9: E G B F#, Emadd9', [rootOrder(chord({chordSource: 'free', freeRoot: 4, freeQuality: 'minor', extensionIndex: SHAPE.add9})), sym({chordSource: 'free', freeRoot: 4, freeQuality: 'minor', extensionIndex: SHAPE.add9})], [pcs('E G B F#'), 'Emadd9']);
check('add9 tones are labeled 1 3 5 9', chord({extensionIndex: SHAPE.add9}).toneLabels, ['1', '3', '5', '9']);
check('6/9 tones are labeled 1 3 5 6 9', chord({extensionIndex: SHAPE['6/9']}).toneLabels, ['1', '3', '5', '6', '9']);
function lanes(o) { var c = chord(o); return [0, 1, 2, 3].map(function (sl) { return ((chordTonePitch(c, sl) % 12) + 12) % 12; }); }
check('bass lanes on Cadd9: the 7 lane plays the root, never the 9th', lanes({extensionIndex: SHAPE.add9}), pcs('C E G C'));
check('bass lanes on C6/9: the 7 lane plays the 6th, as on C6', lanes({extensionIndex: SHAPE['6/9']}), pcs('C E G A'));
check('Cadd9 in first inversion puts E lowest', chord({extensionIndex: SHAPE.add9, inversion: 1}).pitches[0] % 12, PC.E);

console.log('=== tensions: applied and free chords only ===');
var V9ofii = {chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'dominant', extensionIndex: SHAPE['9']};
check('applied V9 of ii: A C# E G B', rootOrder(chord(V9ofii)), pcs('A C# E G B'));
check('...with b9: A C# E G Bb, named A7(b9), label V7(' + F + '9)/ii', [rootOrder(chord(Object.assign({tension: 'b9'}, V9ofii))), sym(Object.assign({tension: 'b9'}, V9ofii)), label(Object.assign({tension: 'b9'}, V9ofii)).degree], [pcs('A C# E G Bb'), 'A7(b9)', 'V7(' + F + '9)/ii']);
check('...with #9: A C# E G C, named A7(#9)', [rootOrder(chord(Object.assign({tension: '#9'}, V9ofii))), sym(Object.assign({tension: '#9'}, V9ofii))], [pcs('A C# E G C'), 'A7(#9)']);
var G13 = {chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: SHAPE['13']};
check('free G13 with #11: G B D F A C# E, named G13(#11)', [rootOrder(chord(Object.assign({tension: '#11'}, G13))), sym(Object.assign({tension: '#11'}, G13))], [pcs('G B D F A C# E'), 'G13(#11)']);
check('free G13 with b13: the top note Eb, named G11(b13)', [rootOrder(chord(Object.assign({tension: 'b13'}, G13))), sym(Object.assign({tension: 'b13'}, G13))], [pcs('G B D F A C Eb'), 'G11(b13)']);
check('free G11 with #11: named G9(#11)', sym({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: SHAPE['11'], tension: '#11'}), 'G9(#11)');
check('the altered tone is labeled b9', chord(Object.assign({tension: 'b9'}, V9ofii)).toneLabels.indexOf(F + '9') >= 0, true);
check('a tension needs its tone: free G7 with b9 is plain G7', [sym({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: SHAPE['7'], tension: 'b9'}), chord({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: SHAPE['7'], tension: 'b9'}).tension], ['G7', null]);
check('on the rails: a diatonic V9 ignores b9 (G B D F A, G9)', [rootOrder(chord({degreeIndex: 4, extensionIndex: SHAPE['9'], tension: 'b9'})), sym({degreeIndex: 4, extensionIndex: SHAPE['9'], tension: 'b9'})], [pcs('G B D F A'), 'G9']);
check('...a diatonic chord gets b9 by borrowing: V9 from harmonic minor is G B D F Ab', rootOrder(chord({degreeIndex: 4, blockModeIndex: 8, extensionIndex: SHAPE['9']})), pcs('G B D F Ab'));

console.log('=== free qualities: augmented and half-diminished ===');
check('free C augmented: C E G#, Caug, label C+', [rootOrder(chord({chordSource: 'free', freeRoot: 0, freeQuality: 'augmented'})), sym({chordSource: 'free', freeRoot: 0, freeQuality: 'augmented'}), label({chordSource: 'free', freeRoot: 0, freeQuality: 'augmented'}).degree], [pcs('C E G#'), 'Caug', 'C+']);
check('free C augmented 7: C E G# Bb, C7#5', [rootOrder(chord({chordSource: 'free', freeRoot: 0, freeQuality: 'augmented', extensionIndex: SHAPE['7']})), sym({chordSource: 'free', freeRoot: 0, freeQuality: 'augmented', extensionIndex: SHAPE['7']})], [pcs('C E G# Bb'), 'C7#5']);
check('free B half-diminished 7: B D F A, Bm7b5, label Bø7', [rootOrder(chord({chordSource: 'free', freeRoot: 11, freeQuality: 'halfDiminished', extensionIndex: SHAPE['7']})), sym({chordSource: 'free', freeRoot: 11, freeQuality: 'halfDiminished', extensionIndex: SHAPE['7']}), label({chordSource: 'free', freeRoot: 11, freeQuality: 'halfDiminished', extensionIndex: SHAPE['7']}).degree], [pcs('B D F A'), 'Bm7b5', 'Bø7']);
check('free B half-diminished triad reads B°', label({chordSource: 'free', freeRoot: 11, freeQuality: 'halfDiminished'}).degree, 'B°');
check('free C major add9 label: Cadd9 (not Cmajadd9)', label({chordSource: 'free', freeRoot: 0, freeQuality: 'major', extensionIndex: SHAPE.add9}).degree, 'Cadd9');

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
