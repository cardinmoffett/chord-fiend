// Checks that the extracted engine gives exactly the same answers as the app it
// came from. It loads original/modal-sketchpad.html with a mock DOM and a mock
// Tone (as the original tests did), sets the app's `state`, and compares every
// engine function against the app's own copy across a wide sweep of settings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from '../src/engine.js';

var here = path.dirname(fileURLToPath(import.meta.url));
var html = fs.readFileSync(path.join(here, '../../original/modal-sketchpad.html'), 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
var full = m[1];
var code = full.slice(full.indexOf('"use strict";') + '"use strict";'.length, full.lastIndexOf('})();'));

function proxyObj() { var o = new Proxy({}, {get: function (t, p) { if (p === 'then') return undefined; if (!(p in t)) { t[p] = function () { return o; }; t[p].value = 0; } return t[p]; }, set: function (t, p, v) { t[p] = v; return true; }}); return o; }
function fe() { var e = {style: {}, children: [], _h: {}, dataset: {}, addEventListener: function () {}, appendChild: function (c) { e.children.push(c); }, classList: {add: function () {}, remove: function () {}, toggle: function () {}}, querySelectorAll: function () { return []; }}; Object.defineProperty(e, 'innerHTML', {set: function () {}, get: function () { return ''; }}); return e; }
var doc = {getElementById: fe, createElement: fe, querySelectorAll: function () { return []; }, body: fe(), addEventListener: function () {}};
globalThis.window = {innerHeight: 800, addEventListener: function () {}};
var T = {start: function () { return {then: function (cb) { cb(); return {catch: function () {}}; }}; }, Transport: {bpm: {value: 100}}, Draw: {}};
['PolySynth', 'Synth', 'MonoSynth', 'FMSynth', 'AMSynth', 'MembraneSynth', 'MetalSynth', 'NoiseSynth', 'Reverb', 'FeedbackDelay', 'Gain', 'Filter', 'Distortion', 'Chorus', 'Limiter'].forEach(function (n) { T[n] = function () { return proxyObj(); }; });

var names = Object.keys(engine);
var app = new Function('document', 'localStorage', 'Tone', code +
  '\nreturn {S: function () { return state; }, fns: {' + names.map(function (n) { return n + ': typeof ' + n + ' === "undefined" ? undefined : ' + n; }).join(',') + '}};'
)(doc, {getItem: function () { return null; }, setItem: function () {}}, T);
var orig = app.fns;
var state = app.S();

var ok = true, passes = 0, failures = 0;
function same(label, a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) { passes++; return; }
  failures++; ok = false;
  if (failures <= 12) console.log('FAIL  ' + label + '\n      app:    ' + JSON.stringify(a) + '\n      engine: ' + JSON.stringify(b));
}
// The one intended difference in chord names: an augmented chord with a flat 7th had no
// name in the app (it showed "G?7"); the engine names it G7#5 / Dm7#5. Where the app's
// name holds a "?", the engine's must be the same name with the "?" filled in that way.
function sameName(label, a, b) {
  if (typeof a === 'string' && a.indexOf('?') >= 0 && typeof b === 'string') {
    var m = /^([A-G][#\u266D]?)\?(\d+)(.*)$/.exec(a);
    if (m && (b === m[1] + m[2] + '#5' + m[3] || b === m[1] + 'm' + m[2] + '#5' + m[3])) { passes++; return; }
  }
  same(label, a, b);
}
function report(t) { console.log((failures === 0 ? 'PASS' : 'FAIL') + '  ' + t + '  (' + passes + ' checks' + (failures ? ', ' + failures + ' FAILED' : '') + ')'); passes = 0; failures = 0; }
function blk(o) { return Object.assign(orig.defaultBlock(), o); }
// The engine's chord carries fields the app's does not (isFree, flat5, bassOffsets,
// addNine, tensions, alter). For the app's own blocks they must be false / null / empty;
// everything else must match exactly. (alter only reads back the chord's own tones.)
function appShape(ch) {
  var c = Object.assign({}, ch);
  if (c.isFree !== false || c.flat5 !== false || c.bassOffsets !== null || c.addNine !== false || c.tensions.length !== 0)
    return {unexpected: {isFree: c.isFree, flat5: c.flat5, bassOffsets: c.bassOffsets, addNine: c.addNine, tensions: c.tensions}};
  delete c.isFree; delete c.flat5; delete c.bassOffsets; delete c.addNine; delete c.tensions; delete c.alter;
  return c;
}

console.log('=== constants ===');
// Names the app never had are the engine's own additions: free mode (checked in test_free_flat5),
// blockLabel (test_block_label), shapes and Alter (test_shapes_tensions).
var additions = names.filter(function (n) { return orig[n] === undefined; });
// EXTENSION_NAMES gained "add9" and "6/9" at the end (checked in test_shapes_tensions); the
// app's six must still come first, unchanged, so saved extensionIndex values keep their meaning.
names.forEach(function (n) {
  if (typeof engine[n] === 'function' || additions.indexOf(n) >= 0) return;
  if (n === 'EXTENSION_NAMES') { same(n + ' (the app\'s six, first)', orig[n], engine[n].slice(0, orig[n].length)); same(n + ' (appended)', ['add9', '6/9'], engine[n].slice(orig[n].length)); return; }
  same(n, orig[n], engine[n]);
});
same('the only additions are blockLabel, shapes, Alter and step numerals', additions.slice().sort(), ['ALTER_FIELDS', 'SHAPE_ORDER', 'alterChange', 'alterFitToShape', 'alterRows', 'blockLabel', 'stepNumeral', 'withoutAlter']);
same('defaultBlock()', orig.defaultBlock(), engine.defaultBlock());
report('every exported constant equals the app\'s');

console.log('\n=== diatonic and borrowed chords: every key, home mode, block mode, degree, extension, sus and aug ===');
var combo = 0;
for (var root = 0; root < 12; root++) {
  state.masterRootIndex = root;
  for (var mm = 0; mm < engine.MASTER_MODE_NAMES.length; mm++) {
    state.masterModeIndex = mm;
    for (var bm = 0; bm < engine.BLOCK_MODE_NAMES.length; bm++)
      for (var deg = 0; deg < 7; deg++)
        for (var ext = 0; ext < orig.EXTENSION_NAMES.length; ext++)
          for (var sus = 0; sus < 3; sus++)
            for (var aug = 0; aug < 2; aug++) {
              combo++;
              // inversion, drop and octave cycle through their values across the sweep
              var b = blk({degreeIndex: deg, blockModeIndex: bm, extensionIndex: ext, susIndex: sus, aug: aug,
                inversion: combo % 8, dropIndex: combo % 4, octave: (combo % 5) - 2});
              var a1 = orig.buildChord(b, root, mm), e1 = engine.buildChord(b, root, mm);
              same('buildChord ' + JSON.stringify(b) + ' root ' + root + ' mode ' + mm, a1, appShape(e1));
              sameName('getChordSymbol ' + JSON.stringify(b) + ' root ' + root + ' mode ' + mm, orig.getChordSymbol(a1), engine.getChordSymbol(e1, root));
            }
  }
}
report('buildChord and getChordSymbol (' + combo + ' blocks)');

console.log('\n=== applied chords: every key, home mode, target, function, extension, sus and aug ===');
combo = 0;
for (root = 0; root < 12; root++) {
  state.masterRootIndex = root;
  for (mm = 0; mm < engine.MASTER_MODE_NAMES.length; mm++) {
    state.masterModeIndex = mm;
    for (var tgt = 0; tgt < 7; tgt++)
      engine.APPLIED_FUNCTIONS.forEach(function (fn) {
        for (var ext = 0; ext < orig.EXTENSION_NAMES.length; ext++)
          for (var sus = 0; sus < 3; sus++)
            for (var aug = 0; aug < 2; aug++) {
              combo++;
              var b = blk({chordSource: 'applied', appliedTargetIndex: tgt, appliedFunction: fn, extensionIndex: ext, susIndex: sus, aug: aug,
                inversion: combo % 8, dropIndex: combo % 4, octave: (combo % 5) - 2});
              var a1 = orig.buildChord(b, root, mm), e1 = engine.buildChord(b, root, mm);
              same('buildChord ' + JSON.stringify(b) + ' root ' + root + ' mode ' + mm, a1, appShape(e1));
              sameName('getChordSymbol ' + JSON.stringify(b), orig.getChordSymbol(a1), engine.getChordSymbol(e1, root));
              same('appliedFunctionLabel ' + JSON.stringify(b) + ' mode ' + mm, orig.appliedFunctionLabel(b), engine.appliedFunctionLabel(b, mm));
            }
      });
  }
}
report('applied buildChord, getChordSymbol and appliedFunctionLabel (' + combo + ' blocks)');

console.log('\n=== smaller helpers ===');
Object.keys(engine.MODES).forEach(function (mode) { same('degreeLabels ' + mode, orig.degreeLabels(mode), engine.degreeLabels(mode)); });
for (root = 0; root < 12; root++) for (mm = 0; mm < 10; mm++) same('keyPrefersFlats ' + root + ' ' + mm, orig.keyPrefersFlats(root, mm), engine.keyPrefersFlats(root, mm));
for (var p = 0; p < 128; p++) {
  same('pitchToNoteName ' + p, orig.pitchToNoteName(p), engine.pitchToNoteName(p));
  same('pitchToNoteName flat ' + p, orig.pitchToNoteName(p, true), engine.pitchToNoteName(p, true));
  same('pitchToFullNoteName ' + p, orig.pitchToFullNoteName(p), engine.pitchToFullNoteName(p));
}
for (var pc = 0; pc < 12; pc++) { same('noteChoiceLabel ' + pc, orig.noteChoiceLabel(pc), engine.noteChoiceLabel(pc)); same('noteChoiceLabel ' + pc + ' 2', orig.noteChoiceLabel(pc, 2), engine.noteChoiceLabel(pc, 2)); }
for (var di = 0; di < engine.DURATION_NAMES.length; di++) for (var dm = 0; dm < 3; dm++) {
  var db = blk({durationIndex: di, durationModifier: dm});
  same('getDurationBeats ' + di + ' ' + dm, orig.getDurationBeats(db), engine.getDurationBeats(db));
}
Object.keys(engine.BUILTIN_BEAT_PATTERNS).concat(['nope']).forEach(function (k) { same('beatPatternLabel ' + k, orig.beatPatternLabel(k), engine.beatPatternLabel(k)); });
report('degreeLabels, keyPrefersFlats, note names, durations and beat labels');

console.log('\n=== bass: every beat, bass lowest note, bass tone setting and chord tone ===');
var custom = {rock: {label: 'Edited Rock', loopBeats: 4, lanes: [
  {voice: 'kick', hits: [{beat: 0, dur: 0.25}]},
  {voice: 'bass1', hits: [{beat: 1, dur: 1}]}, {voice: 'bass5', hits: [{beat: 0.5, dur: 0.5}]},
  {voice: 'bass3', hits: []}, {voice: 'bass7', hits: []}]}};
var beats = Object.keys(engine.BUILTIN_BEAT_PATTERNS).concat(['off', 'unknown']);
[{}, custom].forEach(function (customPatterns) {
  state.customBeatPatterns = customPatterns;
  beats.forEach(function (beat) {
    state.drumBeat = beat;
    same('activeBeatPattern ' + beat, orig.activeBeatPattern(beat), engine.activeBeatPattern(beat, customPatterns));
    for (var low = 20; low <= 52; low += 4) {
      state.bassWrapLow = low;
      for (var deg = 0; deg < 7; deg++) for (var ext = 0; ext < 6; ext += 2) for (var oct = -2; oct <= 2; oct++) [-1, 0, -2].forEach(function (bti) {
        var b = blk({degreeIndex: deg, extensionIndex: ext, octave: oct, bassToneIndex: bti});
        var ch = orig.buildChord(b, 0, 0);
        same('computeBassPitchForBlock beat ' + beat + ' low ' + low + ' ' + JSON.stringify(b),
          orig.computeBassPitchForBlock(b, ch),
          engine.computeBassPitchForBlock(b, ch, engine.activeBeatPattern(beat, customPatterns), low));
        same('bassOctaveShift ' + ch.chordRootPitch + ' low ' + low, orig.bassOctaveShift(ch.chordRootPitch), engine.bassOctaveShift(ch.chordRootPitch, low));
        for (var slot = -1; slot < 8; slot++) same('chordTonePitch slot ' + slot, orig.chordTonePitch(ch, slot), engine.chordTonePitch(ch, slot));
      });
    }
  });
});
engine.BASS_VOICES.concat(['kick', 'snare', 'hihat']).forEach(function (v) { same('bassSlotForVoice ' + v, orig.bassSlotForVoice(v), engine.bassSlotForVoice(v)); });
Object.keys(engine.BUILTIN_BEAT_PATTERNS).forEach(function (k) {
  var pat = engine.BUILTIN_BEAT_PATTERNS[k];
  ['kick', 'snare', 'hihat', 'bass1', 'bass5', 'none'].forEach(function (v) {
    same('laneByVoice ' + k + ' ' + v, orig.laneByVoice(pat, v), engine.laneByVoice(pat, v));
    for (var st = 0; st < 16; st++) same('patternHasHitAtStep ' + k + ' ' + v + ' ' + st, orig.patternHasHitAtStep(orig.laneByVoice(pat, v), st, 4), engine.patternHasHitAtStep(engine.laneByVoice(pat, v), st, 4));
  });
});
report('bass pitches, octave shift, chord tones and pattern lookup');

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
