// Ported from original/tests/test_enharmonic2.js. The checks below are unchanged; only the
// setup above the first check differs. The original loaded the whole app with a
// mock DOM and a mock Tone and read the key and mode from its global `state`.
// Here the functions come from the engine package, and `settings` stands in for
// that state: the wrappers pass it in as the parameters the engine now takes.
import * as engine from '../src/engine.js';
var settings = {masterRootIndex: 0, masterModeIndex: 0};
var api = Object.assign({}, engine, {
  S: function () { return settings; },
  getChordSymbol: function (chord) { return engine.getChordSymbol(chord, settings.masterRootIndex); },
  appliedFunctionLabel: function (block) { return engine.appliedFunctionLabel(block, settings.masterModeIndex); }
});

function blk(o){ return Object.assign(api.defaultBlock(), o); }
var AEOLIAN = api.MASTER_MODE_NAMES.indexOf('Aeolian');
var modeIdx = {};
api.BLOCK_MODE_NAMES.forEach(function(m,i){ modeIdx[m]=i; });

var FLAT = String.fromCharCode(0x266D);
var ok = true;
function check(label, actual, expected) {
  var pass = actual === expected;
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + ' (got "' + actual + '", expected "' + expected + '")');
  if (!pass) ok = false;
}

console.log('=== Unit 8 (C natural minor): chords now correctly spell with flats ===');
api.S().masterRootIndex = 0;
api.S().masterModeIndex = AEOLIAN;
check('plain bVI', api.getChordSymbol(api.buildChord(blk({degreeIndex:5}), 0, AEOLIAN)), 'A' + FLAT);
check('plain bVII', api.getChordSymbol(api.buildChord(blk({degreeIndex:6}), 0, AEOLIAN)), 'B' + FLAT);
check('V7/bVI', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:5, appliedFunction:'dominant', extensionIndex:2}), 0, AEOLIAN)), 'E' + FLAT + '7');
check('plain i (unaffected)', api.getChordSymbol(api.buildChord(blk({degreeIndex:0}), 0, AEOLIAN)), 'Cm');

console.log('\n=== C major home: existing plain V7/V unaffected (still sharp-correct) ===');
api.S().masterRootIndex = 0;
api.S().masterModeIndex = 0;
check('V7/V', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:4, appliedFunction:'dominant', extensionIndex:2}), 0, 0)), 'D7');

console.log('\n=== C major home, borrowed bVI (Unit 2): flat-spelled via the BORROWED mode, not the home key ===');
check('borrowed bVI from Aeolian', api.getChordSymbol(api.buildChord(blk({degreeIndex:5, blockModeIndex:modeIdx.Aeolian}), 0, 0)), 'A' + FLAT);

console.log('\n=== Tritone subs always spell with flats, overriding the general rule ===');
check('subV7/I in C major', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:0, appliedFunction:'tritoneSub', extensionIndex:2}), 0, 0)), 'D' + FLAT + '7');
check('subV7/IV in C major', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:3, appliedFunction:'tritoneSub', extensionIndex:2}), 0, 0)), 'G' + FLAT + '7');

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
