// Strum: each chord starts as one strum, lowest note first; Width is the time from the
// first note to the last, shared evenly. Not at all while the arpeggiator is on.
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
function strum(setting, arp, width) { calls = []; var st = api.state(); st.strum = setting; st.arpEnabled = arp; st.strumWidth = width; api.attackChord([392, 262, 330], 1); return calls; }
same('Off: the whole chord at once', strum('off', false, 80), [[[392, 262, 330], 1000]]);
same('On, width 80 ms: lowest first, the last note 80 ms after the first (C, E, G)', strum('on', false, 80), [[262, 1000], [330, 1040], [392, 1080]]);
same('width 200 ms', strum('on', false, 200).map(function (c) { return c[1]; }), [1000, 1100, 1200]);
calls = []; api.state().strumWidth = 90; api.attackChord([262, 330, 392, 494], 1);
same('a 4-note chord takes the same width: 90 ms over three gaps', calls.map(function (c) { return c[1]; }), [1000, 1030, 1060, 1090]);
same('width is kept between 10 and 300 ms', [strum('on', false, 5000).map(function (c) { return c[1]; }).pop(), strum('on', false, 1).map(function (c) { return c[1]; }).pop()], [1300, 1010]);
same('an older saved speed counts as on', strum('slow', false, 80).length, 3);
same('with the arpeggiator on, no strum', strum('on', true, 80), [[[392, 262, 330], 1000]]);
console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
