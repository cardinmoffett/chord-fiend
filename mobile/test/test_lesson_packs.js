// Lesson packs: a private file of extra Learn units, kept in this phone's storage only.
// Checks that a pack installs, its units follow the built-in ones, its lessons open and
// complete like built-in ones (goals use the same helpers), a new version replaces the
// old one, a broken file is refused without touching what's stored, and removal works.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},options:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}},getBoundingClientRect:function(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},removeChild:function(){},insertBefore:function(){},setAttribute:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}, getComputedStyle:function(){return {paddingTop:'0px',paddingBottom:'0px',getPropertyValue:function(){return '0px';}};}};
global.requestAnimationFrame = function(){};
var doc = { getElementById:function(){return fakeEl();}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var store = {};
var ls = {getItem:function(k){return k in store ? store[k] : null;}, setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {CURRICULUM:CURRICULUM, BUILTIN_UNIT_COUNT:BUILTIN_UNIT_COUNT, findLesson:findLesson, installLessonPack:installLessonPack, removeLessonPack:removeLessonPack, storedLessonPacks:storedLessonPacks, applyLessonPacks:applyLessonPacks, lessonPackErrors:function(){return lessonPackErrors;}, openLesson:openLesson, state:function(){return state;}};')(doc, ls, ToneMock);

var ok = true;
function check(l, c) { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) ok = false; }
function throws(l, fn) { var t = false; try { fn(); } catch (e) { t = true; } check(l, t); }

var builtIn = api.CURRICULUM.length;
check('the built-in units are all there before any pack', builtIn === api.BUILTIN_UNIT_COUNT && builtIn >= 13);

var PACK = '{id: "test", title: "Test Pack", units: [' +
  '{id: "c1", title: "Chapter 1", lessons: [' +
    // A lesson in B-flat: the goal is that block 2 is V (F in B-flat).
    '{id: "five", title: "Find V", masterRoot: 10, intro: "Set block 2 to V.", blocks: function () { return [learnBlock({degreeIndex: 0}), learnBlock({degreeIndex: 3})]; },' +
    ' goal: function (b) { return lessonHas(b[1], [5, 9, 0]) ? {name: "V", reveal: "F A C"} : null; }}' +
  ']},' +
  '{title: "Chapter 2", lessons: [{title: "Two", blocks: function () { return [learnBlock()]; }}]}' +
']}';
var pack = api.installLessonPack(PACK);
check('a pack installs', pack.title === 'Test Pack');
check('its units follow the built-in ones', api.CURRICULUM.length === builtIn + 2 && api.CURRICULUM[builtIn].title === 'Chapter 1');
check('the first unit carries the pack title (the Learn header), the second doesn\'t', api.CURRICULUM[builtIn].packTitle === 'Test Pack' && !api.CURRICULUM[builtIn + 1].packTitle);
check('lesson ids are prefixed with the pack id', !!api.findLesson('test-five'));
check('a lesson without an id gets one', !!api.findLesson('test-test-unit2-1'));
check('it is kept in this phone\'s storage', api.storedLessonPacks().length === 1);

var L = api.findLesson('test-five');
api.openLesson('test-five');
check('a pack lesson can set its own key (B-flat)', api.state().masterRootIndex === 10);
var b = L.blocks();
check('its goal is not met at the start (block 2 is IV, E-flat)', L.goal(b) === null);
b[1].degreeIndex = 4;
check('the goal is met by following it (block 2 is V, F A C), using the app\'s own helpers', !!L.goal(b));

// Reloading the app reads the packs back from storage.
api.applyLessonPacks();
check('after a reload the pack is still there, once', api.CURRICULUM.length === builtIn + 2);

api.installLessonPack(PACK.replace('Test Pack', 'Test Pack v2'));
check('a new version with the same id replaces the old one', api.storedLessonPacks().length === 1 && api.CURRICULUM.length === builtIn + 2 && api.CURRICULUM[builtIn].packTitle === 'Test Pack v2');

throws('a file that isn\'t JavaScript is refused', function () { api.installLessonPack('this is not a pack'); });
throws('a pack without units is refused', function () { api.installLessonPack('{id: "x", title: "X", units: []}'); });
throws('a lesson without blocks() is refused', function () { api.installLessonPack('{id: "x", title: "X", units: [{title: "U", lessons: [{title: "L"}]}]}'); });
check('...and refusing one leaves the stored packs alone', api.storedLessonPacks().length === 1);

store['chordFiendLessonPacks'] = JSON.stringify(api.storedLessonPacks().concat([{id: 'broken', title: 'Broken', text: '{id: "broken"'}]));
api.applyLessonPacks();
check('a stored pack that no longer reads is reported, and the others still load', !!api.lessonPackErrors().broken && api.CURRICULUM.length === builtIn + 2);
api.removeLessonPack('broken');

api.removeLessonPack('test');
check('removing a pack takes its units out', api.CURRICULUM.length === builtIn && !api.findLesson('test-five') && api.storedLessonPacks().length === 0);

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
