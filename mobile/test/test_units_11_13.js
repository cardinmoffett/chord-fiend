// Units 11-13 (Chromatic Color, Color Beyond Triads, Voice Leading): each lesson's goal
// is not met at the start, IS met by following its own instructions, and every note the
// text names is what the app really plays. Expected notes are written from theory (C
// major), not taken from the code.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},options:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){}},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}};
var doc = { getElementById:function(){return fakeEl();}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var ls = {getItem:function(){return null;}, setItem:function(){}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {buildChord:buildChord, findLesson:findLesson, getChordSymbol:function(c){return getChordSymbol(c, 0);}};')(doc, ls, ToneMock);

var ok = true;
function check(l, c) { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) ok = false; }
function same(l, a, e) { var p = JSON.stringify(a) === JSON.stringify(e); console.log((p ? 'PASS' : 'FAIL') + '  ' + l + (p ? '' : '\n      got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(e))); if (!p) ok = false; }

// MIDI note numbers from names, middle C = C4 = 60.
var PC = {C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11};
function n(s) { var m = /^([A-G][#b]?)(-?\d)$/.exec(s); return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12; }
function notes(list) { return list.split(' ').map(n); }
function play(b) { return api.buildChord(b, 0, 0).pitches; }
function lesson(id) { var L = api.findLesson(id); check(id + ' exists', !!L); return L; }
function edit(blocks, i, o) { blocks[i] = Object.assign({}, blocks[i], o); return blocks; }
function goalAtStartAndAfter(L, edits) {
  var b = L.blocks();
  check(L.id + ': goal not met at the start', L.goal(b) === null);
  edits.forEach(function (e) { edit(b, e[0], e[1]); });
  var hit = L.goal(b);
  check(L.id + ': following the instructions meets the goal' + (hit ? ' (' + hit.name + ')' : ''), !!hit);
  return b;
}

console.log('=== Unit 11: Chromatic Color ===');
// The augmented chords are made with Alter (5th: ♯5) on the diatonic block, so they keep
// their numbers (I+, V+); the half-diminished ii comes from borrowing Aeolian.
var L = lesson('u11-line-cliche');
var b = goalAtStartAndAfter(L, [[1, {aug: 1}], [2, {extensionIndex: 1}], [3, {chordSource: 'applied', appliedTargetIndex: 3, appliedFunction: 'dominant'}]]);
same('the four C chords: C-E-G, C-E-G#, C-E-G-A, C-E-G-Bb', [play(b[0]), play(b[1]), play(b[2]), play(b[3])], [notes('C4 E4 G4'), notes('C4 E4 G#4'), notes('C4 E4 G4 A4'), notes('C4 E4 G4 Bb4')]);
same('the top voice walks G, G#, A, Bb', [b[0], b[1], b[2], b[3]].map(function (x) { return Math.max.apply(null, play(x)); }), notes('G4 G#4 A4 Bb4'));
check('C and E never move', [b[0], b[1], b[2], b[3]].every(function (x) { var p = play(x); return p[0] === n('C4') && p[1] === n('E4'); }));
check('Bb settles a half step down onto A in the F chord', play(b[4]).indexOf(n('A4')) >= 0 && n('Bb4') - n('A4') === 1);
check('block 4 starts with a 7th, so Applied gives a dominant 7th', L.blocks()[3].extensionIndex === 2);

L = lesson('u11-aug-passing');
b = goalAtStartAndAfter(L, [[2, {aug: 1}]]);
same('V with a raised 5th (Alter) is G-B-D#', play(b[2]).map(function (p) { return p % 12; }), [PC.G, PC.B, PC['D#']]);
check('D# is a half step below E, the 3rd of C', (PC.E - PC['D#'] + 12) % 12 === 1);
b = L.blocks(); edit(b, 0, {aug: 1});
check('I+ alone also meets the goal (C-E-G#)', !!L.goal(b) && JSON.stringify(play(b[0])) === JSON.stringify(notes('C4 E4 G#4')));

L = lesson('u11-chromatic-mediants');
b = goalAtStartAndAfter(L, [[1, {chordSource: 'free', freeRoot: 4, seventh: 'maj'}]]);
same('Free E major is E-G#-B', play(b[1]), notes('E4 G#4 B4'));
check('E major shares only E with C major', play(b[1]).filter(function (p) { return [0, 4, 7].indexOf(p % 12) >= 0; }).map(function (p) { return p % 12; }).join() === String(PC.E));
b = L.blocks(); edit(b, 1, {chordSource: 'free', freeRoot: 9, seventh: 'maj'});
check('Free A major (A-C#-E) also meets the goal', !!L.goal(b) && JSON.stringify(play(b[1]).map(function (p) { return p % 12; })) === JSON.stringify([PC.A, PC['C#'], PC.E]));
b = L.blocks(); edit(b, 1, {degreeIndex: 5, blockModeIndex: 6});
check('bVI from Aeolian (Ab-C-Eb) also meets the goal and keeps C', !!L.goal(b) && JSON.stringify(play(b[1]).map(function (p) { return p % 12; })) === JSON.stringify([PC.Ab, PC.C, PC.Eb]));

L = lesson('u11-half-diminished');
b = goalAtStartAndAfter(L, [[1, {blockModeIndex: 6}]]);
same('ii7 borrowed from Aeolian is D-F-Ab-C, named Dm7b5', [play(b[1]), api.getChordSymbol(api.buildChord(b[1], 0, 0))], [notes('D4 F4 Ab4 C5'), 'Dm7b5']);
check('its Ab falls a half step to G in V7', play(b[2]).indexOf(n('G4')) >= 0 && n('Ab4') - n('G4') === 1);

console.log('=== Unit 12: Color Beyond Triads ===');
L = lesson('u12-sevenths');
b = goalAtStartAndAfter(L, [[0, {extensionIndex: 2}], [1, {extensionIndex: 2}], [2, {extensionIndex: 2}], [3, {extensionIndex: 2}]]);
same('Cmaj7, Am7, Fmaj7, G7', b.map(function (x) { return api.getChordSymbol(api.buildChord(x, 0, 0)); }), ['Cmaj7', 'Am7', 'Fmaj7', 'G7']);
function hasTritone(x) { var p = play(x).map(function (q) { return q % 12; }); return p.some(function (a) { return p.indexOf((a + 6) % 12) >= 0; }); }
same('only G7 holds a tritone', b.map(hasTritone), [false, false, false, true]);

L = lesson('u12-extensions');
b = goalAtStartAndAfter(L, [[0, {extensionIndex: 3}], [1, {extensionIndex: 5}], [2, {extensionIndex: 3}]]);
same('Dm9 adds E', play(b[0]), notes('D4 F4 A4 C5 E5'));
same('G13 is G-B-D-F-A-C-E', play(b[1]), notes('G4 B4 D5 F5 A5 C6 E6'));
same('...every note of the C major scale', play(b[1]).map(function (p) { return p % 12; }).sort(function (x, y) { return x - y; }), [0, 2, 4, 5, 7, 9, 11]);
same('Cmaj9 adds D', play(b[2]), notes('C4 E4 G4 B4 D5'));
var c11 = play(Object.assign({}, b[3], {extensionIndex: 4}));
check('Cmaj11 holds F, a half step above E in the chord', c11.indexOf(n('F5')) >= 0 && c11.some(function (p) { return p % 12 === PC.E; }));

L = lesson('u12-sus');
b = goalAtStartAndAfter(L, [[1, {susIndex: 2}]]);
same('Vsus4 is G-C-D', play(b[1]), notes('G4 C5 D5'));
check('its C falls to B in the plain V that follows', play(b[2]).indexOf(n('B4')) >= 0);
same('Isus2 is C-D-G, no 3rd', play(Object.assign({}, b[3], {susIndex: 1})), notes('C4 D4 G4'));

L = lesson('u12-six-chords');
b = goalAtStartAndAfter(L, [[0, {extensionIndex: 1}]]);
same('C6 is C-E-G-A', play(b[0]), notes('C4 E4 G4 A4'));
var am7 = play(Object.assign({}, b[1], {extensionIndex: 2}));
same('Am7 is A-C-E-G, the same four notes', am7.map(function (p) { return p % 12; }).sort(), play(b[0]).map(function (p) { return p % 12; }).sort());

console.log('=== Unit 13: Voice Leading ===');
L = lesson('u13-inversions');
check('the bass part is off on every block', L.blocks().every(function (x) { return x.bassToneIndex === -1; }));
b = goalAtStartAndAfter(L, [[1, {inversion: 2}], [2, {inversion: 1}]]);
same('C-E-G, then IV over C (C-F-A), V over B (B-D-G), C-E-G', b.map(play), [notes('C4 E4 G4'), notes('C4 F4 A4'), notes('B3 D4 G4'), notes('C4 E4 G4')]);
var maxMove = 0; for (var i = 1; i < b.length; i++) { var a = play(b[i - 1]), c = play(b[i]); for (var k = 0; k < 3; k++) maxMove = Math.max(maxMove, Math.abs(c[k] - a[k])); }
check('no voice moves more than a third (3 semitones): largest is ' + maxMove, maxMove <= 3);
var rootPos = L.blocks(), maxRoot = 0; for (i = 1; i < rootPos.length; i++) { a = play(rootPos[i - 1]); c = play(rootPos[i]); for (k = 0; k < 3; k++) maxRoot = Math.max(maxRoot, Math.abs(c[k] - a[k])); }
check('in root position some voice jumps further (' + maxRoot + ' semitones)', maxRoot > 3);

L = lesson('u13-walking-bass');
check('the bass part is off on every block', L.blocks().every(function (x) { return x.bassToneIndex === -1; }));
b = goalAtStartAndAfter(L, [[1, {inversion: 1}], [3, {inversion: 2}]]);
same('the lowest notes walk C-B-A-G-F', b.map(function (x) { return Math.min.apply(null, play(x)); }), notes('C4 B3 A3 G3 F3'));

L = lesson('u13-drop2');
b = goalAtStartAndAfter(L, [[0, {dropIndex: 1}], [1, {dropIndex: 1}], [2, {dropIndex: 1}]]);
same('Dm7 drop 2: the second-highest note (A) goes down an octave', play(b[0]), notes('A3 D4 F4 C5'));
same('G7 drop 2: D goes down', play(b[1]), notes('D4 G4 B4 F5'));
same('Cmaj7 drop 2: G goes down', play(b[2]), notes('G3 C4 E4 B4'));

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
