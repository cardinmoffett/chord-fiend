// Free mode and flat five: the engine's two additions to the app. Expected notes and
// names are written from music theory, not from the code.
import { defaultBlock, buildChord, getChordSymbol } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
function blk(o) { return Object.assign(defaultBlock(), o); }
function chord(o, root, mode) { return buildChord(blk(o), root || 0, mode || 0); }
function sym(o, root, mode) { return getChordSymbol(chord(o, root, mode), root || 0); }
function notes(o, root, mode) { return chord(o, root, mode).pitches; }
var F = '♭';

console.log('=== free mode: a root and a quality, outside the key ===');
check('E major in C: E G# B', notes({chordSource: 'free', freeRoot: 4, freeQuality: 'major'}), [64, 68, 71]);
check('...named E', sym({chordSource: 'free', freeRoot: 4, freeQuality: 'major'}), 'E');
check('F minor 7 in C: F Ab C Eb', notes({chordSource: 'free', freeRoot: 5, freeQuality: 'minor', extensionIndex: 2}), [65, 68, 72, 75]);
check('...named Fm7', sym({chordSource: 'free', freeRoot: 5, freeQuality: 'minor', extensionIndex: 2}), 'Fm7');
check('Bb dominant 9 in F: Bb D F Ab C', notes({chordSource: 'free', freeRoot: 10, freeQuality: 'dominant', extensionIndex: 3}, 5), [70, 74, 77, 80, 84]);
check('...named Bb9 in F, which spells with flats', sym({chordSource: 'free', freeRoot: 10, freeQuality: 'dominant', extensionIndex: 3}, 5), 'B' + F + '9');
check('a root below the key root sits above it, as degrees do (A in C is 69, not 57)', notes({chordSource: 'free', freeRoot: 9, freeQuality: 'minor'})[0], 69);
check('octave moves it like any block', notes({chordSource: 'free', freeRoot: 9, freeQuality: 'minor', octave: -1})[0], 57);
check('major 7th quality is a real major 7th', chord({chordSource: 'free', freeRoot: 0, freeQuality: 'major', extensionIndex: 2}).offsets, [0, 4, 7, 11]);
check('sus4 on free', chord({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: 2, susIndex: 2}).offsets, [0, 5, 7, 10]);
check('...named G7sus4', sym({chordSource: 'free', freeRoot: 7, freeQuality: 'dominant', extensionIndex: 2, susIndex: 2}), 'G7sus4');
check('aug on free', sym({chordSource: 'free', freeRoot: 2, freeQuality: 'major', aug: 1}), 'Daug');
check('6 chord on free minor: Dm6 = D F A B', notes({chordSource: 'free', freeRoot: 2, freeQuality: 'minor', extensionIndex: 1}), [62, 65, 69, 71]);
check('inversion and drops work on free chords (E major, 1st inversion: G# B E)', notes({chordSource: 'free', freeRoot: 4, freeQuality: 'major', inversion: 1}), [68, 71, 76]);
check('free chord tone labels', chord({chordSource: 'free', freeRoot: 4, freeQuality: 'minor', extensionIndex: 2}).toneLabels, ['1', F + '3', '5', F + '7']);
check('isFree is set, and the degree is not one of the key\'s', [chord({chordSource: 'free'}).isFree, chord({chordSource: 'free'}).chordDegreeIndex], [true, -1]);
check('B diminished triad: B D F', notes({chordSource: 'free', freeRoot: 11, freeQuality: 'diminished'}), [71, 74, 77]);
check('...named Bdim', sym({chordSource: 'free', freeRoot: 11, freeQuality: 'diminished'}), 'Bdim');
check('C# diminished 7th: C# E G Bb (a fully diminished 7th)', notes({chordSource: 'free', freeRoot: 1, freeQuality: 'diminished', extensionIndex: 2}), [61, 64, 67, 70]);
check('...named C#dim7', sym({chordSource: 'free', freeRoot: 1, freeQuality: 'diminished', extensionIndex: 2}), 'C#dim7');
check('diminished tone labels', chord({chordSource: 'free', freeRoot: 11, freeQuality: 'diminished', extensionIndex: 2}).toneLabels, ['1', F + '3', F + '5', F + F + '7']);
check('a missing quality means major', notes({chordSource: 'free', freeRoot: 0}), [60, 64, 67]);

console.log('\n=== flat five ===');
check('C major with b5: C E Gb', notes({degreeIndex: 0, flat5: 1}), [60, 64, 66]);
check('...named C(b5)', sym({degreeIndex: 0, flat5: 1}), 'C(b5)');
check('G7 with b5: G B Db F', notes({degreeIndex: 4, extensionIndex: 2, flat5: 1}), [67, 71, 73, 77]);
check('...named G7b5', sym({degreeIndex: 4, extensionIndex: 2, flat5: 1}), 'G7b5');
check('Cmaj7 with b5', sym({degreeIndex: 0, extensionIndex: 2, flat5: 1}), 'Cmaj7b5');
check('D minor 7 with b5 is half-diminished: Dm7b5', sym({degreeIndex: 1, extensionIndex: 2, flat5: 1}), 'Dm7b5');
check('label shows the flat 5th', chord({degreeIndex: 4, extensionIndex: 2, flat5: 1}).toneLabels, ['1', '3', F + '5', F + '7']);
check('on an applied dominant: V7/V b5 = D F# Ab C', notes({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 2, flat5: 1}), [74, 78, 80, 84]);
check('on a free chord', sym({chordSource: 'free', freeRoot: 2, freeQuality: 'dominant', extensionIndex: 2, flat5: 1}), 'D7b5');
check('aug wins over b5 when both are set', notes({degreeIndex: 0, aug: 1, flat5: 1}), [60, 64, 68]);
check('the leading-tone chord ignores it (it already has one)', chord({chordSource: 'applied', appliedFunction: 'leadingTone', flat5: 1}).offsets, [0, 3, 6, 9]);
check('flat5 is reported on the chord', [chord({flat5: 1}).flat5, chord({}).flat5], [true, false]);
check('sus chords with b5 say so', sym({degreeIndex: 4, extensionIndex: 2, susIndex: 2, flat5: 1}), 'G7sus4b5');

console.log('=== augmented 7th chords get a name (the app showed "G?7") ===');
check('V7 with a raised 5th in C: G B D# F, named G7#5', [notes({degreeIndex: 4, extensionIndex: 2, aug: 1}), sym({degreeIndex: 4, extensionIndex: 2, aug: 1})], [[67, 71, 75, 77], 'G7#5']);
check('ii7 with a raised 5th in C: D F A# C, named Dm7#5', [notes({degreeIndex: 1, extensionIndex: 2, aug: 1}), sym({degreeIndex: 1, extensionIndex: 2, aug: 1})], [[62, 65, 70, 72], 'Dm7#5']);
check('I maj7 with a raised 5th keeps its name, Cmaj7#5', sym({extensionIndex: 2, aug: 1}), 'Cmaj7#5');

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
