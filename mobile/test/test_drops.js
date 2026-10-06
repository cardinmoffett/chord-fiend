var fs = require('fs');
var html = fs.readFileSync(require('./helpers/load-app').APP, 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
var full = m[1];
var a = full.indexOf('"use strict";') + '"use strict";'.length;
var b = full.lastIndexOf('})();');
var code = full.slice(a, b);

var ok = true, passes = 0, failures = 0;
function check(l, c) { if (c) passes++; else { failures++; ok = false; if (failures <= 12) console.log('FAIL  ' + l); } }
function section(t) { console.log('\n=== ' + t + ' ==='); passes = 0; failures = 0; }
function report(t) { console.log((failures === 0 ? 'PASS' : 'FAIL') + '  ' + t + '  (' + passes + ' checks passed' + (failures ? ', ' + failures + ' FAILED' : '') + ')'); }
function eq(x, y) { return JSON.stringify(x) === JSON.stringify(y); }

function proxyObj() { var o = new Proxy({}, {get: function (t, p) { if (p === 'then') return undefined; if (!(p in t)) { t[p] = function () { return o; }; t[p].value = 0; } return t[p]; }, set: function (t, p, v) { t[p] = v; return true; }}); return o; }
function fe() { var e = {style: {}, children: [], _h: {}, dataset: {}, addEventListener: function () {}, appendChild: function (c) { e.children.push(c); }, classList: {add: function () {}, remove: function () {}, toggle: function () {}}, querySelectorAll: function () { return []; }}; Object.defineProperty(e, 'innerHTML', {set: function () {}, get: function () { return ''; }}); return e; }
var doc = {getElementById: fe, createElement: fe, querySelectorAll: function () { return []; }, body: fe(), addEventListener: function () {}};
global.window = {innerHeight: 800, addEventListener: function () {}};
var T = {start: function () { return {then: function (cb) { cb(); return {catch: function () {}}; }}; }, Transport: {bpm: {value: 100}}, Draw: {}};
['PolySynth', 'Synth', 'MonoSynth', 'FMSynth', 'AMSynth', 'MembraneSynth', 'MetalSynth', 'NoiseSynth', 'Reverb', 'FeedbackDelay', 'Gain', 'Filter', 'Distortion', 'Chorus', 'Limiter'].forEach(function (n) { T[n] = function () { return proxyObj(); }; });
var api = new Function('document', 'localStorage', 'Tone', code + '\nreturn {buildChord:buildChord, defaultBlock:defaultBlock, applyDrops:applyDrops, MASTER_MODE_NAMES:MASTER_MODE_NAMES, DROP_NAMES:DROP_NAMES};')(doc, {getItem: function () { return null; }, setItem: function () {}}, T);
function blk(o) { return Object.assign(api.defaultBlock(), o); }

// ---- The OLD function, verbatim: it indexed the incoming array by POSITION,
// but by the time it runs that array is in tone order, not pitch order, whenever
// an inversion has lifted some tones.
function oldApplyDrops(pitches, dropIndex) {
  var p = pitches.slice(), n = p.length;
  function dropAt(fromTop) { var idx = n - fromTop; if (idx >= 0 && idx < n) p[idx] -= 12; }
  if (dropIndex === 1) dropAt(2);
  else if (dropIndex === 2) dropAt(3);
  else if (dropIndex === 3) { dropAt(2); dropAt(4); }
  p.sort(function (a, b) { return a - b; });
  return p;
}
// ---- The textbook definition, written fresh: take the close-position voicing,
// ordered by pitch; "second from the top" is the second-HIGHEST sounding note.
function textbookDrop(close, dropIndex) {
  var asc = close.slice().sort(function (x, y) { return x - y; });
  var n = asc.length, out = asc.slice();
  function lowerNthHighest(k) { if (k <= n) out[n - k] -= 12; }
  if (dropIndex === 1) lowerNthHighest(2);
  else if (dropIndex === 2) lowerNthHighest(3);
  else if (dropIndex === 3) { lowerNthHighest(2); lowerNthHighest(4); }
  return out.sort(function (x, y) { return x - y; });
}
var NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function name(p) { return NN[p % 12] + (Math.floor(p / 12) - 1); }
function voicing(block, mode) { return api.buildChord(block, 0, mode || 0).pitches; }

// =====================================================================
section('hand-worked voicings (C = middle C = 60; the C7 cases run in Mixolydian, where I7 really is C E G Bb)');
var MIXO = api.MASTER_MODE_NAMES.indexOf('Mixolydian');
function hand(desc, block, expected, mode) {
  var got = voicing(block, mode);
  if (!eq(got, expected)) console.log('   ' + desc + ': got ' + got.map(name).join(' ') + ', expected ' + expected.map(name).join(' '));
  check(desc + ' -> ' + expected.map(name).join(' '), eq(got, expected));
}
hand('C triad, root position, close', blk({}), [60, 64, 67]);
hand('C triad, root position, Drop 2 (E drops)', blk({dropIndex: 1}), [52, 60, 67]);
hand('C triad, 1st inversion, close', blk({inversion: 1}), [64, 67, 72]);
hand('C triad, 1st inversion, Drop 2: the G (2nd from the TOP) drops, not the E', blk({inversion: 1, dropIndex: 1}), [55, 64, 72]);
hand('C triad, 1st inversion, Drop 3: the E (3rd from the top) drops, inversion survives', blk({inversion: 1, dropIndex: 2}), [52, 67, 72]);
hand('C triad, 2nd inversion, Drop 2', blk({inversion: 2, dropIndex: 1}), [60, 67, 76]);
hand('C7, root position, Drop 2 -- the classic G C E Bb', blk({extensionIndex: 2, dropIndex: 1}), [55, 60, 64, 70], MIXO);
hand('C7, 1st inversion, close', blk({extensionIndex: 2, inversion: 1}), [64, 67, 70, 72], MIXO);
hand('C7, 1st inversion, Drop 2 (Bb, 2nd from the top, drops)', blk({extensionIndex: 2, inversion: 1, dropIndex: 1}), [58, 64, 67, 72], MIXO);
hand('C7, 2nd inversion, Drop 2 (the high C drops)', blk({extensionIndex: 2, inversion: 2, dropIndex: 1}), [60, 67, 70, 76], MIXO);
hand('C7, 3rd inversion, Drop 3 (close is Bb C E G; the C, 3rd from the top, drops)', blk({extensionIndex: 2, inversion: 3, dropIndex: 2}), [60, 70, 76, 79], MIXO);
hand('C7, root position, Drop 2+4', blk({extensionIndex: 2, dropIndex: 3}), [48, 55, 64, 70], MIXO);
hand('C7, 1st inversion, Drop 2+4', blk({extensionIndex: 2, inversion: 1, dropIndex: 3}), [52, 58, 67, 72], MIXO);
report('hand-worked voicings');

// =====================================================================
section('every combination matches the textbook definition');
var combos = 0, matchesTextbook = 0, rootOrNoDropChanged = 0, oldAlreadyRight = 0, oldWasWrong = 0;
var dropNames = api.DROP_NAMES;
for (var mi = 0; mi < api.MASTER_MODE_NAMES.length; mi++) {
  for (var deg = 0; deg < 7; deg++) {
    for (var ext = 0; ext <= 5; ext++) {
      for (var inv = 0; inv <= 6; inv++) {
        for (var dr = 0; dr <= 3; dr++) {
          [{}, {susIndex: 1}, {susIndex: 2}, {aug: 1}, {chordSource: 'applied', appliedTargetIndex: 4, appliedFunction: 'dominant'}, {chordSource: 'applied', appliedTargetIndex: 1, appliedFunction: 'leadingTone'}].forEach(function (extra) {
            var base = Object.assign({degreeIndex: deg, extensionIndex: ext, inversion: inv, octave: 0}, extra);
            var close = voicing(blk(Object.assign({}, base, {dropIndex: 0})), mi);       // the inverted close voicing
            var dropped = voicing(blk(Object.assign({}, base, {dropIndex: dr})), mi);
            var expected = textbookDrop(close, dr);
            combos++;
            var tag = api.MASTER_MODE_NAMES[mi] + ' deg' + deg + ' ext' + ext + ' inv' + inv + ' ' + dropNames[dr] + ' ' + JSON.stringify(extra);
            var matches = eq(dropped, expected);
            if (matches) matchesTextbook++;
            check(tag + ': matches the textbook drop voicing', matches);

            // What the OLD function produced from the same notes, in the order it received them (tone order, post-inversion).
            var chordNoDrop = api.buildChord(blk(Object.assign({}, base, {dropIndex: 0})), 0, mi);
            var toneOrder = chordNoDrop.offsets.map(function (o) { return chordNoDrop.chordRootPitch + o; }).sort(function (x, y) { return x - y; });
            var maxInv = Math.max(0, toneOrder.length - 1), n = Math.min(Math.max(inv, 0), maxInv);
            var bassPitch = toneOrder[n];
            for (var k = 0; k < n; k++) { toneOrder[k] += 12; while (toneOrder[k] <= bassPitch) toneOrder[k] += 12; }
            var oldResult = oldApplyDrops(toneOrder, dr);
            if (inv === 0 || dr === 0) {
              // Root position or no drop: the old and new code must agree exactly -- nothing about these may change.
              if (!eq(dropped, oldResult)) rootOrNoDropChanged++;
              check(tag + ': root position or no drop -> sounds exactly as before', eq(dropped, oldResult));
            } else if (eq(oldResult, expected)) {
              oldAlreadyRight++;   // the old code happened to land on the right notes -- those must not move
              check(tag + ': already correct before -> unchanged', eq(dropped, oldResult));
            } else {
              oldWasWrong++;       // the old code lowered the wrong note -- these, and only these, change
              check(tag + ': was wrong before -> now different from the old sound', !eq(dropped, oldResult));
            }
          });
        }
      }
    }
  }
}
console.log('   ' + matchesTextbook + ' of ' + combos + ' voicings match the textbook definition');
console.log('   root position or no drop: ' + rootOrNoDropChanged + ' differ from the old sound (must be 0)');
console.log('   inverted AND dropped: ' + oldAlreadyRight + ' were already right and stay put, ' + oldWasWrong + ' were wrong and change');
check('every voicing matches', matchesTextbook === combos);
check('nothing about root-position or no-drop voicings changed', rootOrNoDropChanged === 0);
report('textbook match + unchanged where it was already right');

// =====================================================================
section('invariants: a drop only re-voices, it never changes the chord');
var inv1 = 0;
for (var mi2 = 0; mi2 < api.MASTER_MODE_NAMES.length; mi2 += 3) {
  for (var ext2 = 0; ext2 <= 5; ext2++) {
    for (var iv = 0; iv <= 6; iv++) {
      for (var d2 = 1; d2 <= 3; d2++) {
        var bb = {degreeIndex: 4, extensionIndex: ext2, inversion: iv};
        var before = voicing(blk(Object.assign({}, bb, {dropIndex: 0})), mi2);
        var after = voicing(blk(Object.assign({}, bb, {dropIndex: d2})), mi2);
        var tag2 = 'mode' + mi2 + ' ext' + ext2 + ' inv' + iv + ' ' + dropNames[d2];
        inv1++;
        check(tag2 + ': same number of notes', after.length === before.length);
        check(tag2 + ': same pitch classes (same chord tones)', eq(before.map(function (p) { return p % 12; }).sort(function (x, y) { return x - y; }), after.map(function (p) { return p % 12; }).sort(function (x, y) { return x - y; })));
        check(tag2 + ': returned low to high', eq(after, after.slice().sort(function (x, y) { return x - y; })));
        check(tag2 + ': no note moved UP (a drop only lowers)', after.reduce(function (s, p) { return s + p; }, 0) < before.reduce(function (s, p) { return s + p; }, 0) || before.length < d2 + 1);
        check(tag2 + ': the bass can only get lower', after[0] <= before[0]);
      }
    }
  }
}
report('invariants (' + inv1 + ' chords)');

// =====================================================================
section('the bug itself, shown against the old function');
var firstInv = blk({inversion: 1, dropIndex: 1});
var close1 = voicing(blk({inversion: 1}));
check('old behaviour reproduced: C triad 1st inversion Drop 2 lowered the E, giving ' + oldApplyDrops([72, 64, 67], 1).map(name).join(' '), eq(oldApplyDrops([72, 64, 67], 1), [52, 67, 72]));
check('now: it lowers the G, giving ' + voicing(firstInv).map(name).join(' '), eq(voicing(firstInv), [55, 64, 72]));
check('old Drop 3 on a 1st-inversion triad threw the inversion away entirely (' + oldApplyDrops([72, 64, 67], 2).map(name).join(' ') + ' = root position)', eq(oldApplyDrops([72, 64, 67], 2), [60, 64, 67]));
check('now Drop 3 keeps the inversion: ' + voicing(blk({inversion: 1, dropIndex: 2})).map(name).join(' '), eq(voicing(blk({inversion: 1, dropIndex: 2})), [52, 67, 72]));
report('the reported bug');

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
