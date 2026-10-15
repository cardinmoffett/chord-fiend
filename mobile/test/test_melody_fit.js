// Melody fit: each melody note is a chord tone, an available tension (a color the chord
// can carry) or an avoid note (a clash), by the usual jazz rules, written here from theory:
// major 9 #11 13; dominant b9 9 #9 #11 b13 13; minor 9 11 13; half-diminished 9 11 b13;
// diminished a whole step above a chord tone. Also checks each block's function, the
// helpers lesson packs use, and the meter (3/4, pickup) a melody lesson can set.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},options:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}},getBoundingClientRect:function(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},removeChild:function(){},insertBefore:function(){},setAttribute:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}, getComputedStyle:function(){return {paddingTop:'0px',paddingBottom:'0px',getPropertyValue:function(){return '0px';}};}};
global.requestAnimationFrame = function(){};
var doc = { getElementById:function(){return fakeEl();}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var store = {};
var ls = {getItem:function(k){return k in store ? store[k] : null;}, setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {buildChord:buildChord, defaultBlock:defaultBlock, noteRole:noteRole, lessonFunction:lessonFunction, installLessonPack:installLessonPack, openLesson:openLesson, sandbox:function(){return sandbox;}, laneMeter:laneMeter, lessonMelodyFit:lessonMelodyFit, melodyFitsEverywhere:melodyFitsEverywhere, describeMelodyFit:describeMelodyFit, state:function(){return state;}, setBeatsPerBar:setBeatsPerBar, getDurationBeats:getDurationBeats, barBlock:barBlock, closeLesson:function(){editingRef=null;}};')(doc, ls, ToneMock);


var ok = true;
function check(l, c) { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) ok = false; }
function same(l, a, e) { var p = JSON.stringify(a) === JSON.stringify(e); console.log((p ? 'PASS' : 'FAIL') + '  ' + l + (p ? '' : '\n      got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(e))); if (!p) ok = false; }
function blk(o) { return Object.assign(api.defaultBlock(), o); }
var PC = {C:0, Db:1, 'C#':1, D:2, Eb:3, 'D#':3, E:4, F:5, 'F#':6, Gb:6, G:7, Ab:8, 'G#':8, A:9, Bb:10, 'A#':10, B:11};
// The role of each named note over a block, in a key (root index, mode index).
function roles(o, notes, root, mode) {
  var b = blk(o), c = api.buildChord(b, root || 0, mode || 0);
  return notes.split(' ').map(function (n) { var r = api.noteRole(c, b, PC[n]); return n + ':' + r.role + (r.name ? '(' + r.name + ')' : ''); });
}

console.log('=== major ===');
same('Cmaj7: E chord tone, D 9, F# #11, A 13, F clashes (natural 11)', roles({extensionIndex: 2}, 'E D F# A F'),
  ['E:chord', 'D:tension(9)', 'F#:tension(♯11)', 'A:tension(13)', 'F:avoid']);
same('a plain C triad on I takes the same tensions (A is the 13, F still clashes)', roles({}, 'D A F'), ['D:tension(9)', 'A:tension(13)', 'F:avoid']);

console.log('=== dominant ===');
same('G7: Ab b9, A 9, Bb #9, C# #11, Eb b13, E 13; C clashes (natural 11)', roles({degreeIndex: 4, extensionIndex: 2}, 'Ab A Bb C# Eb E C'),
  ['Ab:tension(♭9)', 'A:tension(9)', 'Bb:tension(♯9)', 'C#:tension(♯11)', 'Eb:tension(♭13)', 'E:tension(13)', 'C:avoid']);
same('a plain G triad on V is a dominant too (Ab is a b9, not a clash)', roles({degreeIndex: 4}, 'Ab C'), ['Ab:tension(♭9)', 'C:avoid']);
same('the book\'s Silent Night bar 3 in Bb: melody D over A7 is the natural 11, a clash', roles({chordSource: 'applied', appliedFunction: 'dominant', appliedTargetIndex: 2, extensionIndex: 2}, 'D', 10, 0), ['D:avoid']);

console.log('=== minor, half-diminished, diminished ===');
same('Dm7: E 9, G 11, B 13', roles({degreeIndex: 1, extensionIndex: 2}, 'E G B'), ['E:tension(9)', 'G:tension(11)', 'B:tension(13)']);
same('Bm7b5: C# 9, E 11, G b13; C clashes (b9)', roles({degreeIndex: 6, extensionIndex: 2}, 'C# E G C'), ['C#:tension(9)', 'E:tension(11)', 'G:tension(♭13)', 'C:avoid']);
same('B°7 (leading tone into C): C# (a whole step above B) is a tension, C clashes', roles({chordSource: 'applied', appliedFunction: 'leadingTone', appliedTargetIndex: 0}, 'C# C'), ['C#:tension(9)', 'C:avoid']);

console.log('=== function in the key ===');
same('I ii iii IV V vi vii in major: T S T S D T D', [0, 1, 2, 3, 4, 5, 6].map(function (d) { return api.lessonFunction(blk({degreeIndex: d})); }), ['T', 'S', 'T', 'S', 'D', 'T', 'D']);
same('applied: dominants and tritone subs D, applied ii S, mediant none', ['dominant', 'tritoneSub', 'backdoor', 'leadingTone', 'supertonic', 'mediant'].map(function (f) { return api.lessonFunction(blk({chordSource: 'applied', appliedFunction: f})); }), ['D', 'D', 'D', 'D', 'S', null]);
same('a free chord has no function in the key', api.lessonFunction(blk({chordSource: 'free', freeRoot: 3})), null);

console.log('=== a waltz lesson with a pickup, from a pack ===');
// Happy-Birthday-like shape in C, 3/4, one-beat pickup: G (pickup), then bar 1 A G C.
api.installLessonPack('{id: "t", title: "T", units: [{title: "U", lessons: [{id: "w", title: "Waltz", beatsPerBar: 3, pickupBeats: 1,' +
  ' melody: [[0, 4, -5], [4, 4, -3], [8, 4, -5], [12, 4, 0]],' +
  ' blocks: function () { return [learnBlock({durationIndex: 4}), learnBlock({durationIndex: 3, durationModifier: 1})]; },' +
  ' goal: function (b) { return melodyFitsEverywhere(b) ? {name: "fits", reveal: ""} : null; }}]}]}');
api.openLesson('t-w');
same('the lesson\'s meter reaches the lane (3 beats, 1-beat pickup)', api.laneMeter(), {beats: 3, pickup: 1});
var fit = api.lessonMelodyFit(api.sandbox().blocks);
same('pickup G over C is a chord tone; bar 1 over C: A (13) is a tension', [fit[0].notes.map(function (n) { return n.role; }), fit[1].notes.map(function (n) { return n.role; })], [['chord'], ['tension', 'chord', 'chord']]);
check('so the melody fits everywhere', api.melodyFitsEverywhere(api.sandbox().blocks));
same('each note carries its start and length in 16ths', [fit[1].notes[0].start, fit[1].notes[0].len], [4, 4]);
var withF = api.sandbox().blocks.slice(); withF[1] = blk({degreeIndex: 3, durationIndex: 3, durationModifier: 1});
check('over IV (F A C) instead, the G and its neighbours still fit (G is the 9 of F)', api.melodyFitsEverywhere(withF));
var withV7 = api.sandbox().blocks.slice(); withV7[1] = blk({degreeIndex: 4, extensionIndex: 2, durationIndex: 3, durationModifier: 1});
check('over G7, the melody\'s C is the natural 11: it clashes', !api.melodyFitsEverywhere(withV7));
check('the text names a tension as one', /A \(13\) is a tension/.test(api.describeMelodyFit(1)));

console.log('=== the song\'s time signature ===');
api.closeLesson();
var st = api.state();
st.sections = [{id: 1, name: 'S', blocks: [blk({durationIndex: 2}), blk({durationIndex: 3}), blk({durationIndex: 2})]}];
api.setBeatsPerBar(3);
same('3/4: bar-long whole notes become dotted halves (3 beats); a half note stays', st.sections[0].blocks.map(api.getDurationBeats), [3, 2, 3]);
same('a new block is a bar long in 3/4', api.getDurationBeats(api.barBlock()), 3);
api.setBeatsPerBar(4);
same('back to 4/4: they are whole notes again', st.sections[0].blocks.map(api.getDurationBeats), [4, 2, 4]);
same('the setting is saved with the song', st.beatsPerBar, 4);

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
