// Chord types: a block that names its formula (chordType) instead of taking it from the
// key. Expected notes are written from theory by note name, not from the code.
import { defaultBlock, buildChord, getChordSymbol, blockLabel, chordTonePitch, CHORD_TYPES } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
var PC = {C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, Bbb:9, B:11};
function pcs(names) { return names.split(' ').map(function (n) { return PC[n]; }); }
function blk(o) { return Object.assign(defaultBlock(), o); }
function chord(o, root, mode) { return buildChord(blk(o), root || 0, mode || 0); }
function rootOrderPcs(c) { return c.offsets.map(function (o) { return ((c.chordRootPitch + o) % 12 + 12) % 12; }); }

console.log('=== every type, built on C (degree I in C), in root-position order ===');
var expected = {
  maj: 'C E G', min: 'C Eb G', dim: 'C Eb Gb', aug: 'C E G#', sus2: 'C D G', sus4: 'C F G', '5': 'C G',
  add9: 'C E G D', madd9: 'C Eb G D', '6': 'C E G A', m6: 'C Eb G A', '69': 'C E G A D',
  maj7: 'C E G B', '7': 'C E G Bb', m7: 'C Eb G Bb', mmaj7: 'C Eb G B', m7b5: 'C Eb Gb Bb', dim7: 'C Eb Gb Bbb',
  '7sus4': 'C F G Bb', '7b5': 'C E Gb Bb', '7#5': 'C E G# Bb', 'maj7#5': 'C E G# B',
  maj9: 'C E G B D', '9': 'C E G Bb D', m9: 'C Eb G Bb D', '9sus4': 'C F G Bb D', '7b9': 'C E G Bb Db', '7#9': 'C E G Bb D#',
  m11: 'C Eb G Bb D F', '7#11': 'C E G Bb D F#', 'maj7#11': 'C E G B D F#', '13': 'C E G Bb D A', maj13: 'C E G B D A', m13: 'C Eb G Bb D F A'
};
var names = {maj: 'C', min: 'Cm', dim: 'Cdim', aug: 'Caug', sus2: 'Csus2', sus4: 'Csus4', '5': 'C5', add9: 'Cadd9', madd9: 'Cm(add9)', '6': 'C6', m6: 'Cm6', '69': 'C6/9',
  maj7: 'Cmaj7', '7': 'C7', m7: 'Cm7', mmaj7: 'Cm(maj7)', m7b5: 'Cm7b5', dim7: 'Cdim7', '7sus4': 'C7sus4', '7b5': 'C7b5', '7#5': 'C7#5', 'maj7#5': 'Cmaj7#5',
  maj9: 'Cmaj9', '9': 'C9', m9: 'Cm9', '9sus4': 'C9sus4', '7b9': 'C7b9', '7#9': 'C7#9', m11: 'Cm11', '7#11': 'C7#11', 'maj7#11': 'Cmaj7#11', '13': 'C13', maj13: 'Cmaj13', m13: 'Cm13'};
check('every type has an expected spelling here (none untested)', CHORD_TYPES.map(function (t) { return t.id; }).filter(function (id) { return !expected[id]; }), []);
CHORD_TYPES.forEach(function (t) {
  var c = chord({chordType: t.id});
  check(t.id + ' = ' + expected[t.id] + ', named ' + names[t.id], [rootOrderPcs(c), getChordSymbol(c, 0)], [pcs(expected[t.id]), names[t.id]]);
  var sorted = c.pitches.every(function (p, i) { return i === 0 || p > c.pitches[i - 1]; });
  check(t.id + ': notes rise from the root (ninths and up sit above the octave)', sorted && c.pitches[0] === 60, true);
});

console.log('=== the type replaces Extension, Sus and Fifth ===');
check('C with extension 9, sus4, raised 5th, but type 7: plain C E G Bb', rootOrderPcs(chord({chordType: '7', extensionIndex: 3, susIndex: 2, aug: 1})), pcs('C E G Bb'));
check('no type: the key decides, as before (I with extension 7 is Cmaj7)', getChordSymbol(chord({extensionIndex: 2}), 0), 'Cmaj7');

console.log('=== the root still comes from the block ===');
check('ii as maj7 in C: D F# A C#, Dmaj7, label IImaj7', [rootOrderPcs(chord({degreeIndex: 1, chordType: 'maj7'})), getChordSymbol(chord({degreeIndex: 1, chordType: 'maj7'}), 0), blockLabel(blk({degreeIndex: 1, chordType: 'maj7'}), 0, 0).degree], [pcs('D F# A C#'), 'Dmaj7', 'IImaj7']);
check('vi as m(maj7) in C: A C E G#, label vi(maj7)', [rootOrderPcs(chord({degreeIndex: 5, chordType: 'mmaj7'})), blockLabel(blk({degreeIndex: 5, chordType: 'mmaj7'}), 0, 0)], [pcs('A C E G#'), {degree: 'vi(maj7)', name: 'Am(maj7)'}]);
check('I as add9: label Iadd9', blockLabel(blk({chordType: 'add9'}), 0, 0), {degree: 'Iadd9', name: 'Cadd9'});
check('ii as m7b5: label iiø7', blockLabel(blk({degreeIndex: 1, chordType: 'm7b5'}), 0, 0).degree, 'iiø7');
check('V as 7b9 in C: G B D F Ab, label V7♭9', [rootOrderPcs(chord({degreeIndex: 4, chordType: '7b9'})), blockLabel(blk({degreeIndex: 4, chordType: '7b9'}), 0, 0).degree], [pcs('G B D F Ab'), 'V7♭9']);
check('bVI borrowed from Aeolian as maj7: Ab C Eb G, label ♭VImaj7', [rootOrderPcs(chord({degreeIndex: 5, blockModeIndex: 6, chordType: 'maj7'})), blockLabel(blk({degreeIndex: 5, blockModeIndex: 6, chordType: 'maj7'}), 0, 0).degree], [pcs('Ab C Eb G'), '♭VImaj7']);
var a = {chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'dominant', chordType: '7b9'};
check('applied V of ii as 7b9: A C# E G Bb, label V7♭9/ii', [rootOrderPcs(chord(a)), blockLabel(blk(a), 0, 0).degree], [pcs('A C# E G Bb'), 'V7♭9/ii']);
var lt = {chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'leadingTone', chordType: 'm7b5'};
check('leading-tone into V as m7b5: F# A C E, label viiø7/V', [rootOrderPcs(chord(lt)), blockLabel(blk(lt), 0, 0).degree], [pcs('F# A C E'), 'viiø7/V']);
var fr = {chordSource: 'free', freeRoot: 4, freeQuality: 'major', chordType: 'add9'};
check('free E as add9: E G# B F#, label Eadd9', [rootOrderPcs(chord(fr)), blockLabel(blk(fr), 0, 0).degree], [pcs('E G# B F#'), 'Eadd9']);

console.log('=== voicing still works on a typed chord ===');
var inv = chord({chordType: 'add9', inversion: 1});
check('add9 inversion choices are its own tones: 1 3 5 9', inv.toneLabels, ['1', '3', '5', '9']);
check('first inversion puts E lowest', inv.pitches[0] % 12, PC.E);
check('dim7 tones are labeled 1 b3 b5 bb7', chord({chordType: 'dim7'}).toneLabels, ['1', '♭3', '♭5', '♭♭7']);
check('drop 2 on Cmaj7 (type): G drops an octave', chord({chordType: 'maj7', dropIndex: 1}).pitches, [55, 60, 64, 71]);
check('octave -1 moves the whole chord down', chord({chordType: 'add9', octave: -1}).pitches, [48, 52, 55, 62]);

console.log('=== the bass lanes (1, 3, 5, 7) follow roles ===');
function lanes(o) { var c = chord(o); return [0, 1, 2, 3].map(function (s) { return ((chordTonePitch(c, s) % 12) + 12) % 12; }); }
check('Cadd9: 1 3 5 and the 7 lane falls back to the root (no 7th), not the 9th', lanes({chordType: 'add9'}), pcs('C E G C'));
check('Csus4: the 3 lane plays the sus tone, F', lanes({chordType: 'sus4'}), pcs('C F G C'));
check('C6: the 7 lane plays the 6th, A', lanes({chordType: '6'}), pcs('C E G A'));
check('Cm7: Eb in the 3 lane, Bb in the 7 lane', lanes({chordType: 'm7'}), pcs('C Eb G Bb'));
check('C5: no 3rd, so the 3 lane plays the root', lanes({chordType: '5'}), pcs('C C G C'));
check('C13: the 7 lane plays Bb, not a higher extension', lanes({chordType: '13'}), pcs('C E G Bb'));

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
