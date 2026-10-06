var fs = require('fs');
var code = require('./helpers/load-app').innerCode();
function fakeEl(){ var el={style:{},className:'',children:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){}},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
var doc = { getElementById:function(){return fakeEl();}, createElement:function(){return fakeEl();}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var ls = {getItem:function(){return null;}, setItem:function(){}};
global.window = {innerHeight:800, addEventListener:function(){}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {S:function(){return state;}, buildChord:buildChord, defaultBlock:defaultBlock, getChordSymbol:getChordSymbol, MASTER_MODE_NAMES:MASTER_MODE_NAMES, BLOCK_MODE_NAMES:BLOCK_MODE_NAMES, keyPrefersFlats:keyPrefersFlats};')(doc, ls, ToneMock);

function blk(o){ return Object.assign(api.defaultBlock(), o); }
var AEOLIAN = api.MASTER_MODE_NAMES.indexOf('Aeolian');
var modeIdx = {};
api.BLOCK_MODE_NAMES.forEach(function(m,i){ modeIdx[m]=i; });

var FLAT = String.fromCharCode(0x266D);
var ok = true;
function check(label, actual, expected) {
  var pass = actual === expected;
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + ' (got "' + actual + '", expected "' + expected + '")');
  if (!pass) ok = false;
}

console.log('=== Unit 8 (C natural minor): chords now correctly spell with flats ===');
api.S().masterRootIndex = 0;
api.S().masterModeIndex = AEOLIAN;
check('plain bVI', api.getChordSymbol(api.buildChord(blk({degreeIndex:5}), 0, AEOLIAN)), 'A' + FLAT);
check('plain bVII', api.getChordSymbol(api.buildChord(blk({degreeIndex:6}), 0, AEOLIAN)), 'B' + FLAT);
check('V7/bVI', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:5, appliedFunction:'dominant', extensionIndex:2}), 0, AEOLIAN)), 'E' + FLAT + '7');
check('plain i (unaffected)', api.getChordSymbol(api.buildChord(blk({degreeIndex:0}), 0, AEOLIAN)), 'Cm');

console.log('\n=== C major home: existing plain V7/V unaffected (still sharp-correct) ===');
api.S().masterRootIndex = 0;
api.S().masterModeIndex = 0;
check('V7/V', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:4, appliedFunction:'dominant', extensionIndex:2}), 0, 0)), 'D7');

console.log('\n=== C major home, borrowed bVI (Unit 2): flat-spelled via the BORROWED mode, not the home key ===');
check('borrowed bVI from Aeolian', api.getChordSymbol(api.buildChord(blk({degreeIndex:5, blockModeIndex:modeIdx.Aeolian}), 0, 0)), 'A' + FLAT);

console.log('\n=== Tritone subs always spell with flats, overriding the general rule ===');
check('subV7/I in C major', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:0, appliedFunction:'tritoneSub', extensionIndex:2}), 0, 0)), 'D' + FLAT + '7');
check('subV7/IV in C major', api.getChordSymbol(api.buildChord(blk({chordSource:'applied', appliedTargetIndex:3, appliedFunction:'tritoneSub', extensionIndex:2}), 0, 0)), 'G' + FLAT + '7');

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
