var fs = require('fs');
var code = fs.readFileSync('/home/claude/inner_regress.js','utf8');
function fakeEl(){ var el={style:{},className:'',children:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){}},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
var doc = { getElementById:function(){return fakeEl();}, createElement:function(){return fakeEl();}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var ls = {getItem:function(){return null;}, setItem:function(){}};
global.window = {innerHeight:800, addEventListener:function(){}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {S:function(){return state;}, appliedFunctionLabel:appliedFunctionLabel, defaultBlock:defaultBlock, MASTER_MODE_NAMES:MASTER_MODE_NAMES};')(doc, ls, ToneMock);
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
