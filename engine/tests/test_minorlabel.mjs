// Ported from original/tests/test_minorlabel.js. The checks below are unchanged; only the
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
var ok = true;
function check(l,c){ console.log((c?'PASS':'FAIL')+'  '+l); if(!c) ok=false; }

var AEOLIAN = api.MASTER_MODE_NAMES.indexOf('Aeolian');
var block = Object.assign(api.defaultBlock(), {chordSource:'applied', appliedTargetIndex:0, appliedFunction:'dominant'});

console.log("=== in a MAJOR home key, Target=0 correctly labels as uppercase 'I' ===");
api.S().masterModeIndex = 0; // Ionian
check('label is "Dominant of I" (major)', api.appliedFunctionLabel(block) === 'Dominant of I');

console.log("\n=== in a MINOR home key, the SAME target index correctly labels as lowercase 'i' ===");
api.S().masterModeIndex = AEOLIAN;
check('label is now "Dominant of i" (minor) -- not incorrectly still "I"', api.appliedFunctionLabel(block) === 'Dominant of i');

console.log("\n=== a borrowed-major-chord target (III) in Aeolian gets its correct flat-degree label ===");
var block2 = Object.assign(api.defaultBlock(), {chordSource:'applied', appliedTargetIndex:2, appliedFunction:'dominant'});
check('label is "Dominant of \u266DIII"', api.appliedFunctionLabel(block2) === 'Dominant of \u266DIII');

console.log(ok ? "\nALL PASSED" : "\nSOME FAILED");
