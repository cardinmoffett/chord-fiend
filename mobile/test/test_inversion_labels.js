var fs = require('fs');
var html = fs.readFileSync(require('./helpers/load-app').APP, 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
var full = m[1];
var a = full.indexOf('"use strict";') + '"use strict";'.length;
var b = full.lastIndexOf('})();');
var code = full.slice(a, b);

var ok = true, failures = 0;
function check(l, c) { if (c) { passes++; } else { console.log('FAIL  ' + l); ok = false; failures++; } }
var passes = 0;
function section(t) { console.log('\n=== ' + t + ' ==='); }
function report(t) { console.log((failures === 0 ? 'PASS' : 'FAIL') + '  ' + t + '  (' + passes + ' checks passed' + (failures ? ', ' + failures + ' FAILED' : '') + ')'); passes = 0; failures = 0; }

function proxyObj() {
  var obj = new Proxy({}, { get: function (t, p) { if (p === 'then') return undefined; if (!(p in t)) { t[p] = function () { return obj; }; t[p].value = 0; } return t[p]; }, set: function (t, p, v) { t[p] = v; return true; } });
  return obj;
}
var byId = {};
function fakeEl(tag) {
  var el = {style: {}, className: '', children: [], _h: {}, textContent: '', dataset: {}, value: '', disabled: false, tagName: tag, parentNode: null,
    addEventListener: function (n, f) { (el._h[n] = el._h[n] || []).push(f); },
    appendChild: function (c) { c.parentNode = el; el.children.push(c); }, removeChild: function () {}, setPointerCapture: function () {}, scrollIntoView: function () {},
    classList: {_s: {}, add: function (c) { this._s[c] = true; }, remove: function (c) { delete this._s[c]; }, toggle: function (c, v) { if (v === undefined) v = !this._s[c]; if (v) this._s[c] = true; else delete this._s[c]; }, contains: function (c) { return !!this._s[c]; }},
    querySelectorAll: function () { return []; }};
  Object.defineProperty(el, 'innerHTML', {set: function () { el.children = []; }, get: function () { return ''; }});
  return el;
}
var doc = {getElementById: function (id) { if (!byId[id]) byId[id] = fakeEl(); return byId[id]; }, createElement: function (t) { return fakeEl(t); }, querySelectorAll: function () { return []; }, body: fakeEl('body'), addEventListener: function () {}};
var writes = [];
var ls = {getItem: function () { return null; }, setItem: function (k, v) { writes.push([k, v]); }, removeItem: function () {}};
global.window = {innerHeight: 800, addEventListener: function () {}};
var ToneMock = {start: function () { return {then: function (cb) { cb(); return {catch: function () {}}; }}; }, Transport: {scheduleOnce: function (fn, t) { fn(t); return 1; }, scheduleRepeat: function () { return 1; }, clear: function () {}, bpm: {value: 100}, seconds: 0, start: function () {}, stop: function () {}, cancel: function () {}}, Draw: {schedule: function (fn) { fn(); }}};
['PolySynth', 'Synth', 'MonoSynth', 'FMSynth', 'AMSynth', 'MembraneSynth', 'MetalSynth', 'NoiseSynth', 'Reverb', 'FeedbackDelay', 'Gain', 'Filter', 'Distortion', 'Chorus', 'Limiter', 'CrossFade', 'Convolver'].forEach(function (n) { ToneMock[n] = function () { return proxyObj(); }; });
ToneMock.ToneAudioBuffer = {fromArray: function () { return proxyObj(); }};
ToneMock.context = {sampleRate: 8000, state: 'running', resume: function () { return Promise.resolve(); }};
var api = new Function('document', 'localStorage', 'Tone', code +
  '\nreturn {S:function(){return state;}, buildChord:buildChord, defaultBlock:defaultBlock, applyDrops:applyDrops, MASTER_MODE_NAMES:MASTER_MODE_NAMES,' +
  ' renderEditor:renderEditor, setEditing:function(blocks){ editingBlocks = blocks; editingRef = {kind:"section", id:1}; currentView = "section"; state.currentIndex = 0; },' +
  ' chordToneLabel:chordToneLabel, chordToneRoles:chordToneRoles, EXTENSION_NAMES:EXTENSION_NAMES};')(doc, ls, ToneMock);

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

known('augmented triad (free C)', blk({chordSource: 'free', freeRoot: 0, seventh: 'maj', aug: 1}), MODE.Ionian, ['1', '3', S + '5']);
known('augmented major 7th (free C)', blk({chordSource: 'free', freeRoot: 0, seventh: 'maj', aug: 1, extensionIndex: 2}), MODE.Ionian, ['1', '3', S + '5', '7']);
known('augmented on a minor chord (free D minor keeps its b3)', blk({chordSource: 'free', freeRoot: 2, third: 'minor', aug: 1}), MODE.Ionian, ['1', F + '3', S + '5']);
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
    for (var ext = 0; ext < api.EXTENSION_NAMES.length; ext++) { // every shape, add9 and 6/9 included
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

// ----------------------------------------------------------------------
section('the editor dropdown');
function findInversionSelect() {
  var found = null;
  (function walk(el) {
    el.children.forEach(function (c) {
      if (c.children && c.children.length >= 2 && c.children[0].textContent === 'Inversion') found = c.children[1];
      walk(c);
    });
  })(byId['editor']);
  return found;
}
function optionTexts(sel) { return sel.children.map(function (o) { return o.textContent; }); }

function openEditorOn(block) {
  api.S().masterRootIndex = 0; api.S().masterModeIndex = MODE.Ionian;
  api.setEditing([block]);
  api.renderEditor();
  return findInversionSelect();
}
var s1 = openEditorOn(blk({degreeIndex: 0}));
check('triad: dropdown offers 1 3 5', !!s1 && eq(optionTexts(s1), ['1', '3', '5']));
check('...and is no longer the old fixed list of 7 numbers', optionTexts(s1).length === 3);
var s2 = openEditorOn(blk({degreeIndex: 4, extensionIndex: 2}));
check('dominant 7th: 1 3 5 b7', eq(optionTexts(s2), ['1', '3', '5', F + '7']));
var s3 = openEditorOn(blk({degreeIndex: 0, susIndex: 2}));
check('changing to sus4 changes the options: 1 4 5', eq(optionTexts(s3), ['1', '4', '5']));
var s4 = openEditorOn(blk({chordSource: 'free', freeRoot: 0, fifth: '#5'}));
check('a free augmented chord offers 1 3 #5', eq(optionTexts(s4), ['1', '3', S + '5']));
var s5 = openEditorOn(blk({degreeIndex: 0, extensionIndex: api.EXTENSION_NAMES.indexOf('add9')}));
check('add9 offers 1 3 5 9', eq(optionTexts(s5), ['1', '3', '5', '9']));
var s5 = openEditorOn(blk({degreeIndex: 0, extensionIndex: 5}));
check('13th chord offers all seven tones', eq(optionTexts(s5), ['1', '3', '5', '7', '9', '11', '13']));
check('every option\'s value is its position (what gets stored), so saved songs line up', s5.children.every(function (o, i) { return o.value === i; }));

var held = blk({degreeIndex: 4, extensionIndex: 2, inversion: 2});
var s6 = openEditorOn(held);
check('a chord stored at inversion 2 shows the "5" selected', s6.value === 2 && optionTexts(s6)[s6.value] === '5');
var stale = blk({degreeIndex: 0, extensionIndex: 0, inversion: 6});
var s7 = openEditorOn(stale);
check('a leftover inversion from a bigger chord still selects a real option (no blank dropdown)', s7.value === 2 && s7.value < s7.children.length);

var live = blk({degreeIndex: 4, extensionIndex: 2});
var s8 = openEditorOn(live);
s8.value = '3';
s8._h['change'][0]({});
check('picking the 7th stores inversion 3 on the block', live.inversion === 3);
check('...and the chord really does put the 7th in the bass', api.buildChord(live, 0, MODE.Ionian).pitches[0] === api.buildChord(blk({degreeIndex: 4, extensionIndex: 2}), 0, MODE.Ionian).pitches[3]);
check('...and it was saved', writes.length > 0 && JSON.stringify(JSON.parse(writes[writes.length - 1][1])).length > 0);

// A leading-tone chord: the dropdown offers its real dim7 tones.
var s9 = openEditorOn(blk({chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'leadingTone'}));
check('leading-tone chord dropdown: 1 b3 b5 bb7', eq(optionTexts(s9), ['1', F + '3', F + '5', F + F + '7']));
report('editor dropdown');

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
