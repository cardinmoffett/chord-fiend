// Linked arrangement boxes: the editor stays locked, with Edit source / Edit instance
// over it, and an independent box can become a new section it's linked to.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},options:[],listeners:{},addEventListener:function(t,f){el.listeners[t]=f;},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}},getBoundingClientRect:function(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},removeChild:function(){},insertBefore:function(){},setAttribute:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}, getComputedStyle:function(){return {paddingTop:'0px',paddingBottom:'0px',getPropertyValue:function(){return '0px';}};}};
global.requestAnimationFrame = function(){};
var els = {};
var doc = { getElementById:function(id){return els[id] || (els[id] = fakeEl());}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var store = {};
var ls = {getItem:function(k){return k in store ? store[k] : null;}, setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {state:function(){return state;}, editingRef:function(){return editingRef;}, openSlotForEditing:openSlotForEditing, isEditorLocked:isEditorLocked, resolveSlot:resolveSlot, slotToNewSection:slotToNewSection, findSlotById:findSlotById, findSectionById:findSectionById, inlineSlot:inlineSlot};')(doc, ls, ToneMock);

var ok = true;
function check(l, c) { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) ok = false; }
function overlay() { return els.editor.children.filter(function (c) { return c.className === 'lock-overlay'; })[0]; }
function button(label) { var o = overlay(); return o && o.children.filter(function (b) { return b.textContent === label; })[0]; }

var st = api.state();
var sec = {id: 900, name: 'Verse', blocks: [{degreeIndex: 0}, {degreeIndex: 4}]};
st.sections.push(sec);
st.songSlots = [{id: 800, name: 'Verse', blocks: [], sourceSectionId: 900, linked: true},
                {id: 801, name: 'Verse', blocks: [], sourceSectionId: 900, linked: true}];

api.openSlotForEditing(800);
check('a linked box opens locked', api.isEditorLocked());
check('the locked editor has Edit source and Edit instance over it', !!button('Edit source') && !!button('Edit instance'));

button('Edit source').listeners.click();
check('Edit source opens the section itself, unlocked', api.editingRef().kind === 'section' && api.editingRef().id === 900 && !api.isEditorLocked());
check('...with no overlay', !overlay());

api.openSlotForEditing(800);
button('Edit instance').listeners.click();
var slot = api.findSlotById(800);
check('Edit instance makes this box its own copy and unlocks it', !slot.linked && !api.isEditorLocked() && !overlay());
check('...a copy of the section, named with an asterisk', slot.blocks.length === 2 && slot.blocks !== sec.blocks && slot.name === 'Verse*');
check('...and the other box stays linked', api.findSlotById(801).linked);

var before = st.sections.length;
api.slotToNewSection(slot);
var made = api.findSectionById(slot.sourceSectionId);
check('a new linked section is made from the box', st.sections.length === before + 1 && made && made.id !== 900);
check('...with the box\'s blocks (a copy)', made.blocks.length === 2 && made.blocks !== slot.blocks);
check('...named without the asterisk, kept apart from the original\'s name', made.name === 'Verse 2' && slot.name === 'Verse 2');
check('...and the box is now linked to it', slot.linked && api.resolveSlot(slot).source === made);
check('the original section is untouched', api.findSectionById(900).name === 'Verse');

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
