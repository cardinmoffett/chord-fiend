// Hold to play: a quick tap must never leave notes hanging. Two races are reproduced here:
// a strum whose later notes start after the finger lifts, and audio that wakes up only
// after the finger has lifted. Also the bass note, and the bug button's report.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},options:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}},getBoundingClientRect:function(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},removeChild:function(){},insertBefore:function(){},setAttribute:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}, getComputedStyle:function(){return {paddingTop:'0px',paddingBottom:'0px',getPropertyValue:function(){return '0px';}};}};
global.requestAnimationFrame = function(){};
var doc = { getElementById:function(){return fakeEl();}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var store = {};
var ls = {getItem:function(k){return k in store ? store[k] : null;}, setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code +
  '\nvar pendingAudio = []; ensureAudioReady = function (cb) { pendingAudio.push(cb); };' +
  '\nreturn {holdPitches:holdPitches, releaseHeld:releaseHeld, debugReport:debugReport, flush:function(){ var p = pendingAudio; pendingAudio = []; p.forEach(function(cb){cb();}); },' +
  ' setSynths:function(s, b){ synth = s; bassSynth = b; }, state:function(){return state;}};')(doc, ls, Object.assign({}, ToneMock, {now: function () { return 10; }}));
var ok = true;
function check(l, c) { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) ok = false; }
var log;
function fresh() {
  log = [];
  api.setSynths({
    triggerAttack: function (f, t) { log.push(['attack', f, t]); },
    triggerRelease: function (f, t) { log.push(['release', f, t]); },
    releaseAll: function (t) { log.push(['releaseAll', t]); }
  }, {
    triggerAttack: function (f, t) { log.push(['bassAttack', f, t]); },
    triggerRelease: function (t) { log.push(['bassRelease', t]); }
  });
}
var st = api.state(); st.arpEnabled = false;

console.log('=== a quick tap with Strum on (40 ms between notes) ===');
fresh(); st.strum = 'on'; st.strumWidth = 40;
api.holdPitches([60, 64, 67], 36); api.flush(); api.releaseHeld();
var attacks = log.filter(function (x) { return x[0] === 'attack'; }).map(function (x) { return x[2]; });
var rel = log.filter(function (x) { return x[0] === 'release'; })[0];
check('the strum\'s notes start at 10.00, 10.04 and 10.08', JSON.stringify(attacks.map(function (t) { return Math.round(t * 100); })) === '[1000,1004,1008]');
check('the release comes after the last of them, not before', rel && rel[2] > Math.max.apply(null, attacks));
check('the bass is released too, at the same time', log.some(function (x) { return x[0] === 'bassRelease' && x[1] === rel[2]; }));

console.log('=== a quick tap while the audio is still waking up ===');
fresh(); st.strum = 'off';
api.holdPitches([60, 64, 67], 36); api.releaseHeld(); api.flush();
check('the finger lifted before the audio was ready: nothing starts, so nothing can hang', !log.some(function (x) { return x[0] === 'attack' || x[0] === 'bassAttack'; }));

console.log('=== a normal hold ===');
fresh();
api.holdPitches([60, 64, 67], 36); api.flush();
check('notes and bass start when held', log.some(function (x) { return x[0] === 'attack'; }) && log.some(function (x) { return x[0] === 'bassAttack'; }));
api.releaseHeld();
check('...and stop when released', log.some(function (x) { return x[0] === 'release'; }) && log.some(function (x) { return x[0] === 'bassRelease'; }));

console.log('=== the bug button\'s report ===');
var report = api.debugReport();
check('it names the audio state, the sound settings and what is held, then the log', /Audio: /.test(report) && /strum off/.test(report) && /held \[\]/.test(report) && /--- log ---/.test(report) && /hold #\d+ release at/.test(report));
console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
