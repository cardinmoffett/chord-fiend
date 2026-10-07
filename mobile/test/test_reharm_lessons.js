// Unit 10 (Reharmonization): every claim the lesson text makes about which melody
// notes sit in which chord, checked against the chords the app really builds.
// Expected chord notes and melody notes are written from theory (C major), not
// taken from the code.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){}},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}};
var doc = { getElementById:function(){return fakeEl();}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var ls = {getItem:function(){return null;}, setItem:function(){}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {buildChord:buildChord, defaultBlock:defaultBlock, findLesson:findLesson, getDurationBeats:getDurationBeats};')(doc, ls, ToneMock);

var ok = true;
function check(l, c) { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) ok = false; }
function same(l, a, e) { var p = JSON.stringify(a) === JSON.stringify(e); console.log((p ? 'PASS' : 'FAIL') + '  ' + l + (p ? '' : '\n      got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(e))); if (!p) ok = false; }

// Pitch classes, C = 0.
var C = 0, Db = 1, D = 2, Eb = 3, E = 4, F = 5, Fs = 6, G = 7, Ab = 8, A = 9, Bb = 10, B = 11;
function pcsOf(block) { return api.buildChord(block, 0, 0).pitches.map(function (p) { return p % 12; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; }); }
function sorted(a) { return a.slice().sort(function (x, y) { return x - y; }); }
function with_(block, o) { return Object.assign({}, block, o); }
// The melody notes (pitch classes, in order) heard over block i of a lesson.
function melodyOver(lesson, blocks, i) {
  var start = 0; for (var k = 0; k < i; k++) start += api.getDurationBeats(blocks[k]);
  var end = start + api.getDurationBeats(blocks[i]);
  return lesson.melody.filter(function (n) { return n[0] / 4 >= start && n[0] / 4 < end; }).map(function (n) { return ((n[2] % 12) + 12) % 12; });
}

var odeNotes = [E, E, F, G, G, F, E, D, C, C, D, E, E, D, D];
var twinkleNotes = [C, C, G, G, A, A, G, F, F, E, E, D, D, C];

console.log('=== the melodies are the real tunes ===');
var L1 = api.findLesson('u10-one-note-many-chords');
var L2 = api.findLesson('u10-borrow-under-melody');
var L3 = api.findLesson('u10-v7-of-iv');
var L4 = api.findLesson('u10-deceptive-ending');
same('Ode to Joy, bars 1-4: E E F G | G F E D | C C D E | E D D', L1.melody.map(function (n) { return n[2] % 12; }), odeNotes);
[L2, L3, L4].forEach(function (L) { same(L.id + ': Twinkle, C C G G | A A G | F F E E | D D C', L.melody.map(function (n) { return n[2] % 12; }), twinkleNotes); });
[L1, L2, L3, L4].forEach(function (L) {
  var total = L.blocks().reduce(function (s, b) { return s + api.getDurationBeats(b); }, 0);
  var last = Math.max.apply(null, L.melody.map(function (n) { return (n[0] + n[1]) / 4; }));
  check(L.id + ': the melody fits inside the section (' + last + ' of ' + total + ' beats)', last <= total);
  var notesInOrder = L.melody.every(function (n, i) { return i === 0 || n[0] >= L.melody[i - 1][0] + L.melody[i - 1][1]; });
  check(L.id + ': one note at a time, in order', notesInOrder);
});

console.log('=== One Note, Many Chords (Ode to Joy) ===');
var b1 = L1.blocks();
same('bar 3 sings C C D E', melodyOver(L1, b1, 2), [C, C, D, E]);
same('vi is A C E', pcsOf(with_(b1[2], {degreeIndex: 5})), sorted([A, C, E]));
check('C and E are in vi, D is not', [C, E].every(function (x) { return pcsOf(with_(b1[2], {degreeIndex: 5})).indexOf(x) >= 0; }) && pcsOf(with_(b1[2], {degreeIndex: 5})).indexOf(D) < 0);
same('bar 1 sings E E F G', melodyOver(L1, b1, 0), [E, E, F, G]);
same('iii is E G B', pcsOf(with_(b1[0], {degreeIndex: 2})), sorted([E, G, B]));

console.log('=== Borrowing Under a Melody (Twinkle) ===');
var b2 = L2.blocks();
same('block 5 is IV under F F', [pcsOf(b2[4]), melodyOver(L2, b2, 4)], [sorted([F, A, C]), [F, F]]);
var iv = with_(b2[4], {blockModeIndex: 6});
same('IV borrowed from Aeolian is iv: F Ab C', pcsOf(iv), sorted([F, Ab, C]));
check('the melody F is in iv', pcsOf(iv).indexOf(F) >= 0);
same('block 3 is IV under A A', [pcsOf(b2[2]), melodyOver(L2, b2, 2)], [sorted([F, A, C]), [A, A]]);
check('iv on block 3: A is not in it, Ab (a half step away) is', pcsOf(with_(b2[2], {blockModeIndex: 6})).indexOf(A) < 0 && pcsOf(with_(b2[2], {blockModeIndex: 6})).indexOf(Ab) >= 0);

console.log('=== Pointing at the Next Chord (Twinkle, V7/IV) ===');
var b3 = L3.blocks();
same('block 4 holds the long G', melodyOver(L3, b3, 3), [G]);
check('block 4 is preset with a 7th, so the applied chord is a dominant 7th', b3[3].extensionIndex === 2);
var c7 = with_(b3[3], {chordSource: 'applied', appliedTargetIndex: 3, appliedFunction: 'dominant'});
same('Applied, target IV, dominant of: C7 = C E G Bb', pcsOf(c7), sorted([C, E, G, Bb]));
check('the melody G is in C7', pcsOf(c7).indexOf(G) >= 0);
same('block 5 is IV, F A C (where Bb leans down to A)', pcsOf(b3[4]), sorted([F, A, C]));

console.log('=== A Deceptive Ending (Twinkle) ===');
var b4 = L4.blocks();
same('the last block holds the final C', melodyOver(L4, b4, 7), [C]);
same('vi is A C E', pcsOf(with_(b4[7], {degreeIndex: 5})), sorted([A, C, E]));
var bVI = with_(b4[7], {degreeIndex: 5, blockModeIndex: 6});
same('bVI (vi borrowed from Aeolian) is Ab C Eb', pcsOf(bVI), sorted([Ab, C, Eb]));
check('the final C is in both', pcsOf(with_(b4[7], {degreeIndex: 5})).indexOf(C) >= 0 && pcsOf(bVI).indexOf(C) >= 0);

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
