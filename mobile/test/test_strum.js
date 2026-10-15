// Strum: each chord starts as one strum, lowest note first, each note a fixed gap after the
// one below (Fast 18 ms, Medium 40, Slow 80), and not at all while the arpeggiator is on.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},options:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}},getBoundingClientRect:function(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},removeChild:function(){},insertBefore:function(){},setAttribute:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}, getComputedStyle:function(){return {paddingTop:'0px',paddingBottom:'0px',getPropertyValue:function(){return '0px';}};}};
global.requestAnimationFrame = function(){};
var doc = { getElementById:function(){return fakeEl();}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var store = {};
var ls = {getItem:function(k){return k in store ? store[k] : null;}, setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {attackChord:attackChord, setSynth:function(s){synth=s;}, state:function(){return state;}};')(doc, ls, ToneMock);
var ok = true;
function same(l, a, e) { var p = JSON.stringify(a) === JSON.stringify(e); console.log((p ? 'PASS' : 'FAIL') + '  ' + l + (p ? '' : '\n      got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(e))); if (!p) ok = false; }
var calls = [];
api.setSynth({triggerAttack: function (f, t) { calls.push([f, Math.round(t * 1000)]); }});
function strum(setting, arp) { calls = []; api.state().strum = setting; api.state().arpEnabled = arp; api.attackChord([392, 262, 330], 1); return calls; }
same('Off: the whole chord at once', strum('off', false), [[[392, 262, 330], 1000]]);
same('Medium: lowest first, 40 ms apart (C, E, G)', strum('medium', false), [[262, 1000], [330, 1040], [392, 1080]]);
same('Fast: 18 ms apart', strum('fast', false).map(function (c) { return c[1]; }), [1000, 1018, 1036]);
same('Slow: 80 ms apart', strum('slow', false).map(function (c) { return c[1]; }), [1000, 1080, 1160]);
same('with the arpeggiator on, no strum', strum('slow', true), [[[392, 262, 330], 1000]]);
console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
