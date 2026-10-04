var fs = require('fs');
var code = fs.readFileSync('/home/claude/inner_regress.js','utf8');
function fakeEl(){ var el={style:{},className:'',children:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){}},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
var doc = { getElementById:function(){return fakeEl();}, createElement:function(){return fakeEl();}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var ls = {getItem:function(){return null;}, setItem:function(){}};
global.window = {innerHeight:800, addEventListener:function(){}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {CURRICULUM:CURRICULUM, buildChord:buildChord, getChordSymbol:getChordSymbol};')(doc, ls, ToneMock);
var ok = true;
function check(l,c){ console.log((c?'PASS':'FAIL')+'  '+l); if(!c) ok=false; }
function findLesson(id){ var f=null; api.CURRICULUM.forEach(function(u){(u.lessons||[]).forEach(function(l){if(l.id===id)f=l;});}); return f; }

// Simulate the EXACT literal instruction: only chordSource/appliedTargetIndex/appliedFunction
// get set via the Chord/Target/Function dropdowns -- nothing else is touched manually.
function applyLiteralEdit(block, target, fn) {
  return Object.assign({}, block, {chordSource: 'applied', appliedTargetIndex: target, appliedFunction: fn});
}

function verify(lessonId, blockIdx, target, fn, expectedSymbol) {
  var lesson = findLesson(lessonId);
  var blocks = lesson.blocks();
  var edited = applyLiteralEdit(blocks[blockIdx], target, fn);
  var chord = api.buildChord(edited, 0, 0);
  var symbol = api.getChordSymbol(chord);
  check(lessonId + ': literal edit (Target/Function only) produces ' + expectedSymbol + ' (got ' + symbol + ', ' + chord.pitches.length + ' notes)', symbol === expectedSymbol);
}

verify('u3-v-of-v', 2, 4, 'dominant', 'D7');
verify('u3-v-of-vi', 2, 5, 'dominant', 'E7');
verify('u3-v-of-iv', 2, 3, 'dominant', 'C7');
verify('u4-subv-of-i', 3, 0, 'tritoneSub', 'D♭7');
verify('u4-subv-of-iv', 2, 3, 'tritoneSub', 'G♭7');
verify('u7-mid-phrase', 1, 4, 'dominant', 'D7');
verify('u7-chain', 1, 5, 'dominant', 'E7');
verify('u7-chain', 3, 1, 'dominant', 'A7');

console.log(ok ? "\nALL PASSED" : "\nSOME FAILED");
