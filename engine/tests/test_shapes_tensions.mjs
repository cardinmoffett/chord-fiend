// Shapes (add9, 6/9), the Alter rows (3rd with sus, 5th, 7th, 9th, 11th, 13th), and free
// chords shaped by Alter. Expected notes are written from theory, not from the code.
import { defaultBlock, buildChord, getChordSymbol, blockLabel, chordTonePitch, EXTENSION_NAMES, SHAPE_ORDER, alterRows, alterChange, alterFitToShape, withoutAlter } from '../src/engine.js';

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
check('free E minor add9: E G B F#, Emadd9', [rootOrder(chord({chordSource: 'free', freeRoot: 4, third: 'minor', extensionIndex: SHAPE.add9})), sym({chordSource: 'free', freeRoot: 4, third: 'minor', extensionIndex: SHAPE.add9})], [pcs('E G B F#'), 'Emadd9']);
check('add9 tones are labeled 1 3 5 9', chord({extensionIndex: SHAPE.add9}).toneLabels, ['1', '3', '5', '9']);
check('6/9 tones are labeled 1 3 5 6 9', chord({extensionIndex: SHAPE['6/9']}).toneLabels, ['1', '3', '5', '6', '9']);
function lanes(o) { var c = chord(o); return [0, 1, 2, 3].map(function (sl) { return ((chordTonePitch(c, sl) % 12) + 12) % 12; }); }
check('bass lanes on Cadd9: the 7 lane plays the root, never the 9th', lanes({extensionIndex: SHAPE.add9}), pcs('C E G C'));
check('bass lanes on C6/9: the 7 lane plays the 6th, as on C6', lanes({extensionIndex: SHAPE['6/9']}), pcs('C E G A'));
check('Cadd9 in first inversion puts E lowest', chord({extensionIndex: SHAPE.add9, inversion: 1}).pitches[0] % 12, PC.E);

console.log('=== tensions ===');
var V9ofii = {chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'dominant', extensionIndex: SHAPE['9']};
check('applied V9 of ii: A C# E G B', rootOrder(chord(V9ofii)), pcs('A C# E G B'));
check('...with b9: A C# E G Bb, named A7(b9), label V7(' + F + '9)/ii', [rootOrder(chord(Object.assign({ninth: 'b9'}, V9ofii))), sym(Object.assign({ninth: 'b9'}, V9ofii)), label(Object.assign({ninth: 'b9'}, V9ofii)).degree], [pcs('A C# E G Bb'), 'A7(b9)', 'V7(' + F + '9)/ii']);
check('...with #9: A C# E G C, named A7(#9)', [rootOrder(chord(Object.assign({ninth: '#9'}, V9ofii))), sym(Object.assign({ninth: '#9'}, V9ofii))], [pcs('A C# E G C'), 'A7(#9)']);
var G13 = {chordSource: 'free', freeRoot: 7, extensionIndex: SHAPE['13']};
check('free G13 with #11: G B D F A C# E, named G13(#11)', [rootOrder(chord(Object.assign({eleventh: '#11'}, G13))), sym(Object.assign({eleventh: '#11'}, G13))], [pcs('G B D F A C# E'), 'G13(#11)']);
check('free G13 with b13: the top note Eb, named G11(b13)', [rootOrder(chord(Object.assign({thirteenth: 'b13'}, G13))), sym(Object.assign({thirteenth: 'b13'}, G13))], [pcs('G B D F A C Eb'), 'G11(b13)']);
check('free G11 with #11: named G9(#11)', sym({chordSource: 'free', freeRoot: 7, extensionIndex: SHAPE['11'], eleventh: '#11'}), 'G9(#11)');
check('the altered tone is labeled b9', chord(Object.assign({ninth: 'b9'}, V9ofii)).toneLabels.indexOf(F + '9') >= 0, true);
check('a tension needs its tone: free G7 with b9 is plain G7', [sym({chordSource: 'free', freeRoot: 7, extensionIndex: SHAPE['7'], ninth: 'b9'}), chord({chordSource: 'free', freeRoot: 7, extensionIndex: SHAPE['7'], ninth: 'b9'}).tensions], ['G7', []]);
check('a diatonic V9 takes b9 too (G B D F Ab, G7(b9))', [rootOrder(chord({degreeIndex: 4, extensionIndex: SHAPE['9'], ninth: 'b9'})), sym({degreeIndex: 4, extensionIndex: SHAPE['9'], ninth: 'b9'})], [pcs('G B D F Ab'), 'G7(b9)']);
check('...the same notes come from borrowing: V9 from harmonic minor is G B D F Ab', rootOrder(chord({degreeIndex: 4, blockModeIndex: 8, extensionIndex: SHAPE['9']})), pcs('G B D F Ab'));

console.log('=== free chords shaped by Alter ===');
check('free I augmented: C E G#, Caug, label I+', [rootOrder(chord({chordSource: 'free', freeRoot: 0, fifth: '#5'})), sym({chordSource: 'free', freeRoot: 0, fifth: '#5'}), label({chordSource: 'free', freeRoot: 0, fifth: '#5'}).degree], [pcs('C E G#'), 'Caug', 'I+']);
check('free C augmented 7: C E G# Bb, C7#5', [rootOrder(chord({chordSource: 'free', freeRoot: 0, fifth: '#5', extensionIndex: SHAPE['7']})), sym({chordSource: 'free', freeRoot: 0, fifth: '#5', extensionIndex: SHAPE['7']})], [pcs('C E G# Bb'), 'C7#5']);
check('free VII half-diminished 7: B D F A, Bm7b5, label viiø7', [rootOrder(chord({chordSource: 'free', freeRoot: 11, third: 'minor', fifth: 'b5', extensionIndex: SHAPE['7']})), sym({chordSource: 'free', freeRoot: 11, third: 'minor', fifth: 'b5', extensionIndex: SHAPE['7']}), label({chordSource: 'free', freeRoot: 11, third: 'minor', fifth: 'b5', extensionIndex: SHAPE['7']}).degree], [pcs('B D F A'), 'Bm7b5', 'viiø7']);
check('free VII half-diminished triad reads vii°', label({chordSource: 'free', freeRoot: 11, third: 'minor', fifth: 'b5'}).degree, 'vii°');
check('free I major add9 label: Iadd9 (not Imajadd9)', label({chordSource: 'free', freeRoot: 0, seventh: 'maj', extensionIndex: SHAPE.add9}).degree, 'Iadd9');

console.log('=== several alterations at once ===');
check('V13 with b9 and #11: G B D F Ab C# E, G13(b9,#11), V13(' + F + '9,' + S + '11)', [rootOrder(chord({degreeIndex: 4, extensionIndex: SHAPE['13'], ninth: 'b9', eleventh: '#11'})), label({degreeIndex: 4, extensionIndex: SHAPE['13'], ninth: 'b9', eleventh: '#11'})], [pcs('G B D F Ab C# E'), {degree: 'V13(' + F + '9,' + S + '11)', name: 'G13(b9,#11)'}]);
check('V13 with #11 and b13: the number steps down to 9, G9(#11,b13)', sym({degreeIndex: 4, extensionIndex: SHAPE['13'], eleventh: '#11', thirteenth: 'b13'}), 'G9(#11,b13)');
check('vi9 with a major 7th and b9: A C E G# Bb, Am(maj7)(b9)', [rootOrder(chord({degreeIndex: 5, extensionIndex: SHAPE['9'], seventh: 'maj', ninth: 'b9'})), sym({degreeIndex: 5, extensionIndex: SHAPE['9'], seventh: 'maj', ninth: 'b9'})], [pcs('A C E G# Bb'), 'Am(maj7)(b9)']);
check('add9 with a flat 9: C E G Db, C(addb9), Iadd' + F + '9', [rootOrder(chord({extensionIndex: SHAPE.add9, ninth: 'b9'})), sym({extensionIndex: SHAPE.add9, ninth: 'b9'}), label({extensionIndex: SHAPE.add9, ninth: 'b9'}).degree], [pcs('C E G Db'), 'C(addb9)', 'Iadd' + F + '9']);
check('iii9 in C has the key\'s b9 (F); a natural 9 gives E G B D F#, Em9', [rootOrder(chord({degreeIndex: 2, extensionIndex: SHAPE['9'], ninth: '9'})), sym({degreeIndex: 2, extensionIndex: SHAPE['9'], ninth: '9'})], [pcs('E G B D F#'), 'Em9']);
check('IV11 in C has the key\'s #11 (B); 11 gives the natural Bb', rootOrder(chord({degreeIndex: 3, extensionIndex: SHAPE['11'], eleventh: '11'})), pcs('F A C E G Bb'));

console.log('=== the double-flat 7th ===');
check('vii7 with a bb7: B D F Ab, Bdim7, vii°7', [rootOrder(chord({degreeIndex: 6, extensionIndex: SHAPE['7'], seventh: 'dim'})), label({degreeIndex: 6, extensionIndex: SHAPE['7'], seventh: 'dim'})], [pcs('B D F Ab'), {degree: 'vii°7', name: 'Bdim7'}]);
check('its tones read 1 b3 b5 bb7', chord({degreeIndex: 6, extensionIndex: SHAPE['7'], seventh: 'dim'}).toneLabels, ['1', F + '3', F + '5', F + F + '7']);

console.log('=== sus and the 9th / 11th ===');
check('sus2 ignores the 9th setting (it already is the 9th\'s note)', rootOrder(chord({degreeIndex: 4, extensionIndex: SHAPE['9'], susIndex: 1, ninth: 'b9'})), pcs('G A D F A'));
check('sus4 ignores the 11th setting', rootOrder(chord({degreeIndex: 4, extensionIndex: SHAPE['11'], susIndex: 2, eleventh: '#11'})), pcs('G C D F A C'));

console.log('=== applied chords keep their function\'s 3rd and 7th ===');
check('V7/ii with a minor 3rd and a major 7th set is still A C# E G', rootOrder(chord(Object.assign({third: 'minor', seventh: 'maj', extensionIndex: SHAPE['7']}, {chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'dominant'}))), pcs('A C# E G'));
check('...but its 5th alters: V7#5/ii is A C# E# G', rootOrder(chord({chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'dominant', extensionIndex: SHAPE['7'], fifth: '#5'})), pcs('A C# F G'));

console.log('=== free chords start as a major triad with a flat 7th ===');
check('free V triad: G B D', rootOrder(chord({chordSource: 'free', freeRoot: 7})), pcs('G B D'));
check('free V7: G B D F, V7', [rootOrder(chord({chordSource: 'free', freeRoot: 7, extensionIndex: SHAPE['7']})), label({chordSource: 'free', freeRoot: 7, extensionIndex: SHAPE['7']}).degree], [pcs('G B D F'), 'V7']);
check('free 6 chord: C E G A', rootOrder(chord({chordSource: 'free', freeRoot: 0, extensionIndex: SHAPE['6']})), pcs('C E G A'));

console.log('=== the rows an editor shows ===');
function rows(o) { return alterRows(blk(o), 0, 0).map(function (r) { return r.field; }); }
function row(o, f) { return alterRows(blk(o), 0, 0).filter(function (r) { return r.field === f; })[0]; }
check('a triad: 3rd and 5th', rows({}), ['third', 'fifth']);
check('add9: 3rd, 5th, 9th', rows({extensionIndex: SHAPE.add9}), ['third', 'fifth', 'ninth']);
check('a 6 chord: 3rd and 5th (no 6th row)', rows({extensionIndex: SHAPE['6']}), ['third', 'fifth']);
check('13: every row', rows({extensionIndex: SHAPE['13']}), ['third', 'fifth', 'seventh', 'ninth', 'eleventh', 'thirteenth']);
check('sus2 hides the 9th', rows({extensionIndex: SHAPE['13'], susIndex: 1}), ['third', 'fifth', 'seventh', 'eleventh', 'thirteenth']);
check('sus4 hides the 11th', rows({extensionIndex: SHAPE['13'], susIndex: 2}), ['third', 'fifth', 'seventh', 'ninth', 'thirteenth']);
check('applied: no 7th row, and its 3rd row is sus2 / 3 / sus4', [rows({chordSource: 'applied', appliedTargetIndex: 1, extensionIndex: SHAPE['9']}), row({chordSource: 'applied', appliedTargetIndex: 1}, 'third').choices.map(function (c) { return c.value; })], [['third', 'fifth', 'ninth'], ['sus2', 'major', 'sus4']]);
check('the leading-tone dim7 has no rows', rows({chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'leadingTone'}), []);
check('V7 reads 3, 5, b7 (the key\'s own values)', ['third', 'fifth', 'seventh'].map(function (f) { var r = row({degreeIndex: 4, extensionIndex: SHAPE['7']}, f); return [r.value, r.keyValue]; }), [['major', 'major'], ['5', '5'], ['min', 'min']]);
check('the 7th row is spelled bb7, b7, 7', row({extensionIndex: SHAPE['7']}, 'seventh').choices.map(function (c) { return c.label; }), [F + F + '7', F + '7', '7']);
check('iii9: the 9th row reads b9, the key\'s', [row({degreeIndex: 2, extensionIndex: SHAPE['9']}, 'ninth').value, row({degreeIndex: 2, extensionIndex: SHAPE['9']}, 'ninth').keyValue], ['b9', 'b9']);

console.log('=== picking a value ===');
check('picking the key\'s own value clears the change', alterChange(blk({degreeIndex: 4, extensionIndex: SHAPE['7'], seventh: 'maj'}), 'seventh', 'min', 0, 0), {seventh: undefined});
check('picking another value sets it', alterChange(blk({degreeIndex: 4, extensionIndex: SHAPE['7']}), 'seventh', 'dim', 0, 0), {seventh: 'dim'});
check('sus2 sets susIndex and clears the 3rd and the 9th', alterChange(blk({third: 'minor', ninth: 'b9'}), 'third', 'sus2', 0, 0), {susIndex: 1, third: undefined, ninth: undefined});
check('the key\'s 3rd after sus clears both', alterChange(blk({susIndex: 2}), 'third', 'major', 0, 0), {susIndex: 0, third: undefined});
check('a 5th clears the older aug and flat5', alterChange(blk({aug: 1}), 'fifth', 'b5', 0, 0), {fifth: 'b5', aug: 0, flat5: 0});
check('withoutAlter clears sus too', withoutAlter(blk({susIndex: 2, ninth: 'b9', thirteenth: 'b13'})).susIndex, 0);

console.log('=== a shape change keeps only the alterations it still has room for ===');
var fit = alterFitToShape(blk({extensionIndex: SHAPE['9'], third: 'minor', seventh: 'maj', ninth: 'b9', eleventh: '#11', thirteenth: 'b13'}));
check('13 -> 9 keeps the 3rd, 7th and 9th', [fit.third, fit.seventh, fit.ninth, fit.eleventh, fit.thirteenth], ['minor', 'maj', 'b9', undefined, undefined]);
fit = alterFitToShape(blk({extensionIndex: SHAPE.add9, seventh: 'maj', ninth: '#9'}));
check('-> add9 drops the 7th, keeps the 9th', [fit.seventh, fit.ninth], [undefined, '#9']);

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
