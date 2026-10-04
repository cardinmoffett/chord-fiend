// Ported from original/tests/test_inversion_labels.js. The checks below are unchanged; only the
// setup above the first check differs. The original loaded the whole app with a
// mock DOM and a mock Tone and read the key and mode from its global `state`.
// Here the functions come from the engine package, and `settings` stands in for
// that state: the wrappers pass it in as the parameters the engine now takes.
// Its last section, "the editor dropdown", tests the app's editor UI rather than the
// engine. It is left out here and belongs with the editor (build plan step 5).
import * as engine from '../src/engine.js';
var settings = {masterRootIndex: 0, masterModeIndex: 0};
var api = Object.assign({}, engine, {
  S: function () { return settings; },
  getChordSymbol: function (chord) { return engine.getChordSymbol(chord, settings.masterRootIndex); },
  appliedFunctionLabel: function (block) { return engine.appliedFunctionLabel(block, settings.masterModeIndex); }
});
var ok = true, failures = 0;
function check(l, c) { if (c) { passes++; } else { console.log('FAIL  ' + l); ok = false; failures++; } }
var passes = 0;
function section(t) { console.log('\n=== ' + t + ' ==='); }
function report(t) { console.log((failures === 0 ? 'PASS' : 'FAIL') + '  ' + t + '  (' + passes + ' checks passed' + (failures ? ', ' + failures + ' FAILED' : '') + ')'); passes = 0; failures = 0; }

var F = '\u266D', S = '\u266F';
function blk(o) { return Object.assign(api.defaultBlock(), o); }
// Extension indexes: 0 triad, 1 "6", 2 seventh, 3 ninth, 4 eleventh, 5 thirteenth. Sus: 1 = sus2, 2 = sus4.
function labels(block, mode) { return api.buildChord(block, 0, mode).toneLabels; }
function eq(actual, expected) { return JSON.stringify(actual) === JSON.stringify(expected); }
var MODE = {}; api.MASTER_MODE_NAMES.forEach(function (n, i) { MODE[n] = i; });

// ----------------------------------------------------------------------
section('hand-checked chords (expected labels written from music theory, not from the code)');
function known(desc, block, mode, expected) {
  var got = labels(block, mode);
  if (!eq(got, expected)) console.log('   ' + desc + ': got ' + got.join(' ') + ' expected ' + expected.join(' '));
  check(desc + ' -> ' + expected.join(' '), eq(got, expected));
}
known('major triad (I, Ionian)', blk({degreeIndex: 0}), MODE.Ionian, ['1', '3', '5']);
known('major 7th (I7, Ionian)', blk({degreeIndex: 0, extensionIndex: 2}), MODE.Ionian, ['1', '3', '5', '7']);
known('dominant 7th (V7, Ionian)', blk({degreeIndex: 4, extensionIndex: 2}), MODE.Ionian, ['1', '3', '5', F + '7']);
known('minor triad (ii, Ionian)', blk({degreeIndex: 1}), MODE.Ionian, ['1', F + '3', '5']);
known('minor 7th (ii7, Ionian)', blk({degreeIndex: 1, extensionIndex: 2}), MODE.Ionian, ['1', F + '3', '5', F + '7']);
known('diminished triad (vii, Ionian)', blk({degreeIndex: 6}), MODE.Ionian, ['1', F + '3', F + '5']);
known('half-diminished 7th (vii7, Ionian)', blk({degreeIndex: 6, extensionIndex: 2}), MODE.Ionian, ['1', F + '3', F + '5', F + '7']);
known('minor tonic (i, Aeolian)', blk({degreeIndex: 0}), MODE.Aeolian, ['1', F + '3', '5']);
known('minor 7th tonic (i7, Aeolian)', blk({degreeIndex: 0, extensionIndex: 2}), MODE.Aeolian, ['1', F + '3', '5', F + '7']);
known('minor-major 7th (i7, HarmonicMinor)', blk({degreeIndex: 0, extensionIndex: 2}), MODE.HarmonicMinor, ['1', F + '3', '5', '7']);

known('sus2 triad', blk({degreeIndex: 0, susIndex: 1}), MODE.Ionian, ['1', '2', '5']);
known('sus4 triad', blk({degreeIndex: 0, susIndex: 2}), MODE.Ionian, ['1', '4', '5']);
known('sus2 with a major 7th', blk({degreeIndex: 0, susIndex: 1, extensionIndex: 2}), MODE.Ionian, ['1', '2', '5', '7']);
known('dominant 7sus4 (V, Ionian)', blk({degreeIndex: 4, susIndex: 2, extensionIndex: 2}), MODE.Ionian, ['1', '4', '5', F + '7']);
known('sus2 with a 9th keeps both the 2 and the 9', blk({degreeIndex: 0, susIndex: 1, extensionIndex: 3}), MODE.Ionian, ['1', '2', '5', '7', '9']);
known('sus4 on a Lydian-colored degree (IV in Ionian has a #4 against its root)', blk({degreeIndex: 3, susIndex: 2}), MODE.Ionian, ['1', S + '4', '5']);

known('augmented triad', blk({degreeIndex: 0, aug: 1}), MODE.Ionian, ['1', '3', S + '5']);
known('augmented major 7th', blk({degreeIndex: 0, aug: 1, extensionIndex: 2}), MODE.Ionian, ['1', '3', S + '5', '7']);
known('augmented on a minor degree (ii aug keeps its b3)', blk({degreeIndex: 1, aug: 1}), MODE.Ionian, ['1', F + '3', S + '5']);
known('naturally augmented III in harmonic minor', blk({degreeIndex: 2}), MODE.HarmonicMinor, ['1', '3', S + '5']);

known('major 6th chord (I6, Ionian)', blk({degreeIndex: 0, extensionIndex: 1}), MODE.Ionian, ['1', '3', '5', '6']);
known('minor 6th in Dorian is a natural 6', blk({degreeIndex: 0, extensionIndex: 1}), MODE.Dorian, ['1', F + '3', '5', '6']);
known('minor "6th" in Aeolian is really a b6 -- named honestly', blk({degreeIndex: 0, extensionIndex: 1}), MODE.Aeolian, ['1', F + '3', '5', F + '6']);

known('9th chord (I9)', blk({degreeIndex: 0, extensionIndex: 3}), MODE.Ionian, ['1', '3', '5', '7', '9']);
known('dominant 9th (V9)', blk({degreeIndex: 4, extensionIndex: 3}), MODE.Ionian, ['1', '3', '5', F + '7', '9']);
known('11th chord (I11)', blk({degreeIndex: 0, extensionIndex: 4}), MODE.Ionian, ['1', '3', '5', '7', '9', '11']);
known('13th chord (I13)', blk({degreeIndex: 0, extensionIndex: 5}), MODE.Ionian, ['1', '3', '5', '7', '9', '11', '13']);
known('Lydian 13th has its signature #11', blk({degreeIndex: 0, extensionIndex: 5}), MODE.Lydian, ['1', '3', '5', '7', '9', S + '11', '13']);
known('Phrygian 9th has its signature b9', blk({degreeIndex: 0, extensionIndex: 3}), MODE.Phrygian, ['1', F + '3', '5', F + '7', F + '9']);
known('Phrygian 13th: b9 and b13', blk({degreeIndex: 0, extensionIndex: 5}), MODE.Phrygian, ['1', F + '3', '5', F + '7', F + '9', '11', F + '13']);
known('Locrian 13th: b3 b5 b7 b9 11 b13', blk({degreeIndex: 0, extensionIndex: 5}), MODE.Locrian, ['1', F + '3', F + '5', F + '7', F + '9', '11', F + '13']);

known('applied dominant (V7/V)', blk({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 2}), MODE.Ionian, ['1', '3', '5', F + '7']);
known('applied dominant 9th', blk({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 3}), MODE.Ionian, ['1', '3', '5', F + '7', '9']);
known('applied dominant, sus4', blk({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 2, susIndex: 2}), MODE.Ionian, ['1', '4', '5', F + '7']);
known('applied dominant, sus2', blk({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 2, susIndex: 1}), MODE.Ionian, ['1', '2', '5', F + '7']);
known('applied dominant, augmented', blk({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 2, aug: 1}), MODE.Ionian, ['1', '3', S + '5', F + '7']);
known('applied dominant, 6th', blk({chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant', extensionIndex: 1}), MODE.Ionian, ['1', '3', '5', '6']);
known('tritone substitution', blk({chordSource: 'applied', appliedTargetIndex: 0, appliedFunction: 'tritoneSub', extensionIndex: 2}), MODE.Ionian, ['1', '3', '5', F + '7']);
known('leading-tone chord is a true dim7: 1 b3 b5 bb7', blk({chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'leadingTone'}), MODE.Ionian, ['1', F + '3', F + '5', F + F + '7']);
known('leading-tone chord ignores sus/aug/extension settings', blk({chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'leadingTone', susIndex: 2, aug: 1, extensionIndex: 5}), MODE.Ionian, ['1', F + '3', F + '5', F + F + '7']);
report('hand-checked chords');

// ----------------------------------------------------------------------
section('every combination: labels must describe the notes that actually sound');
// An independent reading of a label back into semitones (written separately
// from chordToneLabel, so a bug there can't hide itself).
var MAJOR_REF = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21};
function semitonesOfLabel(label) {
  var flats = (label.match(/\u266D/g) || []).length, sharps = (label.match(/\u266F/g) || []).length;
  var role = parseInt(label.replace(/[\u266D\u266F]/g, ''), 10);
  return MAJOR_REF[role] - flats + sharps;
}
var combos = 0;
var drops = [0, 1, 2, 3];
for (var mi = 0; mi < api.MASTER_MODE_NAMES.length; mi++) {
  for (var deg = 0; deg < 7; deg++) {
    for (var ext = 0; ext <= 5; ext++) {
      for (var sus = 0; sus <= 2; sus++) {
        for (var aug = 0; aug <= 1; aug++) {
          combos++;
          var base = blk({degreeIndex: deg, extensionIndex: ext, susIndex: sus, aug: aug});
          var root = api.buildChord(base, 0, mi);
          var tag = api.MASTER_MODE_NAMES[mi] + ' deg' + deg + ' ext' + ext + ' sus' + sus + ' aug' + aug;
          check(tag + ': one label per sounding tone', root.toneLabels.length === root.pitches.length && root.toneLabels.length === root.offsets.length);
          // Root position, close voicing: tone i is pitches[i], and its label must name exactly that interval above the root.
          var allMatch = root.toneLabels.every(function (lab, i) { return semitonesOfLabel(lab) === root.pitches[i] - root.chordRootPitch; });
          check(tag + ': each label names the exact interval its note sits above the root', allMatch);
          check(tag + ': first tone is always the root, labelled "1"', root.toneLabels[0] === '1');

          // Choosing option i must put exactly that tone in the bass.
          for (var inv = 0; inv < root.toneLabels.length; inv++) {
            var c = api.buildChord(Object.assign({}, base, {inversion: inv}), 0, mi);
            check(tag + ' inv' + inv + ': the lowest note is the tone labelled "' + root.toneLabels[inv] + '"', c.pitches[0] === root.pitches[inv]);
            check(tag + ' inv' + inv + ': reported effective inversion matches', c.inversion === inv);
            check(tag + ' inv' + inv + ': labels do not change just because the inversion did', eq(c.toneLabels, root.toneLabels));
            check(tag + ' inv' + inv + ': same set of pitch classes as root position (inversions only move notes by octaves)', eq(c.pitches.map(function (p) { return p % 12; }).sort(function (x, y) { return x - y; }), root.pitches.map(function (p) { return p % 12; }).sort(function (x, y) { return x - y; })));
          }
        }
      }
    }
  }
}
console.log('   (' + combos + ' chord shapes x every inversion checked)');
report('every degree x mode x extension x sus x aug');

// ----------------------------------------------------------------------
section('the sound of existing songs: unchanged wherever it was already honest');
// A reference copy of the OLD inversion step (sort, lift the lowest n tones ONE
// octave). Drops here deliberately use the CURRENT applyDrops, so this section
// isolates the inversion change only -- the drop fix is checked separately in
// test_drops.js, against a verbatim copy of the old drop function. Saved blocks carry the same numbers as before, so
// every block whose old sound already matched its label must sound identical.
function oldPre(block, mode) {
  var ch = api.buildChord(Object.assign({}, block, {inversion: 0, dropIndex: 0}), 0, mode);
  var p = ch.offsets.map(function (o) { return ch.chordRootPitch + o; }).sort(function (x, y) { return x - y; });
  var n = Math.min(Math.max(block.inversion || 0, 0), Math.max(0, p.length - 1));
  var rootPos = p.slice();
  for (var i = 0; i < n; i++) p[i] += 12;
  return {pre: p, rootPos: rootPos, n: n};
}
function oldFinal(block, mode) { return api.applyDrops(oldPre(block, mode).pre, block.dropIndex || 0); }
var total = 0, unchangedCount = 0, changed = [];
for (var mi2 = 0; mi2 < api.MASTER_MODE_NAMES.length; mi2++) {
  for (var deg2 = 0; deg2 < 7; deg2++) {
    for (var ext2 = 0; ext2 <= 5; ext2++) {
      for (var inv2 = 0; inv2 <= 6; inv2++) {
        for (var dr = 0; dr < 4; dr++) {
          [{}, {susIndex: 1}, {susIndex: 2}, {aug: 1}, {chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant'}].forEach(function (extra) {
            var bk = blk(Object.assign({degreeIndex: deg2, extensionIndex: ext2, inversion: inv2, dropIndex: dr, octave: 1}, extra));
            total++;
            var nowChord = api.buildChord(bk, 0, mi2);
            var o = oldPre(bk, mi2);
            var oldBassHonest = o.pre.slice().sort(function (x, y) { return x - y; })[0] === o.rootPos[o.n];
            var nowPre = api.buildChord(Object.assign({}, bk, {dropIndex: 0}), 0, mi2).pitches;
            if (eq(nowPre, o.pre) || eq(nowPre.slice().sort(function (x, y) { return x - y; }), o.pre.slice().sort(function (x, y) { return x - y; }))) {
              unchangedCount++;
              check('mode' + mi2 + ' deg' + deg2 + ' ext' + ext2 + ' inv' + inv2 + ' drop' + dr + ' ' + JSON.stringify(extra) + ': same notes as before', eq(nowChord.pitches, oldFinal(bk, mi2)));
            } else {
              changed.push({ext: ext2, inv: inv2, oldBassHonest: oldBassHonest});
              // The ONLY permitted reason for a change: the old sound put the wrong note in the bass.
              check('mode' + mi2 + ' deg' + deg2 + ' ext' + ext2 + ' inv' + inv2 + ' ' + JSON.stringify(extra) + ': changed only because the old bass note was NOT the labelled tone', !oldBassHonest);
              check('mode' + mi2 + ' deg' + deg2 + ' ext' + ext2 + ' inv' + inv2 + ' ' + JSON.stringify(extra) + ': ...and it is the labelled tone now', api.buildChord(Object.assign({}, bk, {dropIndex: 0}), 0, mi2).pitches[0] === o.rootPos[o.n]);
            }
          });
        }
      }
    }
  }
}
var changedOnlyExtendedHigh = changed.every(function (c) { return c.ext >= 3 && c.inv >= 4; });
check('every changed case is a 9th/11th/13th chord at inversion 4 or higher (nothing else moved)', changedOnlyExtendedHigh);
console.log('   (' + total + ' saved-block variants compared: ' + unchangedCount + ' sound exactly as before, ' + changed.length + ' changed -- all 9th/11th/13th chords at inversion 4+)');
report('backward compatibility');

// ----------------------------------------------------------------------
section('labels do not depend on voicing choices');
var vb = blk({degreeIndex: 4, extensionIndex: 3});
var vref = labels(vb, MODE.Ionian);
[0, 1, 2, 3].forEach(function (d) { [-3, -1, 0, 2, 3].forEach(function (o) {
  check('drop ' + d + ' octave ' + o + ': same labels', eq(labels(Object.assign({}, vb, {dropIndex: d, octave: o}), MODE.Ionian), vref));
}); });
report('voicing independence');

// ----------------------------------------------------------------------
section('clamping: a stored inversion that no longer fits');
var big = blk({degreeIndex: 0, extensionIndex: 0, inversion: 6});
var clamped = api.buildChord(big, 0, MODE.Ionian);
check('inversion 6 on a triad is effectively the last tone (index 2)', clamped.inversion === 2);
check('...which has a real label to display', clamped.toneLabels[clamped.inversion] === '5');
check('negative or missing inversion is treated as root position', api.buildChord(blk({inversion: -3}), 0, MODE.Ionian).inversion === 0 && api.buildChord(blk({inversion: undefined}), 0, MODE.Ionian).inversion === 0);
report('clamping');

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
