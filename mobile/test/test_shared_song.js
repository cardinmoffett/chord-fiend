// Send to Live / Paste from Live: a project becomes the engine's shared song text and back.
// What a song is made of survives the trip; pasting adds a new project and touches nothing else.
var code = require('./helpers/load-app').innerCode();
function fakeEl(tag){ var el={style:{},className:'',children:[],dataset:{},options:[],listeners:{},addEventListener:function(t,f){el.listeners[t]=f;},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}},getBoundingClientRect:function(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},removeChild:function(){},insertBefore:function(){},setAttribute:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}, matchMedia:function(){return {matches:false};}, getComputedStyle:function(){return {paddingTop:'0px',paddingBottom:'0px',getPropertyValue:function(){return '0px';}};}};
global.requestAnimationFrame = function(){};
var els = {};
var doc = { getElementById:function(id){return els[id] || (els[id] = fakeEl());}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var store = {};
var ls = {getItem:function(k){return k in store ? store[k] : null;}, setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {state:function(){return state;}, store:function(){return projectsStore;}, activeProject:activeProject, projectToSharedSong:projectToSharedSong, sharedSongToState:sharedSongToState, importSharedSong:importSharedSong, encodeSharedSong:encodeSharedSong, decodeSharedSong:decodeSharedSong, defaultBlock:defaultBlock, openLesson:openLesson, switchToLearnHome:switchToLearnHome, CURRICULUM:CURRICULUM};')(doc, ls, ToneMock);

var ok = true;
function check(l, c) { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) ok = false; }
var blk = function (o) { return Object.assign(api.defaultBlock(), o); };

var p = api.activeProject();
var st = api.state();
st.masterRootIndex = 7; st.masterModeIndex = 5; st.beatsPerBar = 3; st.drumBeat = 'jazzwaltz'; st.bassWrapLow = 31; st.tempo = 140;
st.instrument = 'piano-not-shared'; st.strum = 'on';
st.sections = [
  {id: 4, name: 'Verse', blocks: [blk({degreeIndex: 1, extensionIndex: 2, third: 'sus4'}), blk({chordSource: 'applied', appliedFunction: 'backdoor', appliedTargetIndex: 0})]},
  {id: 9, name: 'Chorus', blocks: [blk({chordSource: 'free', freeRoot: 8})]}
];
st.songSlots = [
  {id: 1, name: 'Verse', blocks: JSON.parse(JSON.stringify(st.sections[0].blocks)), sourceSectionId: 4, linked: true},
  null, // an empty box in the arrangement
  {id: 2, name: 'Verse*', blocks: [blk({degreeIndex: 4})], sourceSectionId: 4, linked: false},
  {id: 3, name: 'Tag', blocks: [blk({degreeIndex: 5})], sourceSectionId: null, linked: false},
  {id: 4, name: 'Chorus', blocks: [blk({chordSource: 'free', freeRoot: 8})], sourceSectionId: 9, linked: true}
];
p.name = 'Night Train';

var shared = api.projectToSharedSong(p);
check('linked boxes go as links, other boxes with their own chords, empty boxes are left out',
  JSON.stringify(shared.parts.map(function (x) { return [x.section, x.linked]; })) === JSON.stringify([[4, true], [4, false], [null, false], [9, true]]));
check('the key, meter, beat, bass range and tempo go; sounds and strum do not', shared.rootIndex === 7 && shared.modeIndex === 5 && shared.beatsPerBar === 3 && shared.drumBeat === 'jazzwaltz' && shared.bassWrapLow === 31 && shared.tempo === 140 && !('instrument' in shared) && !('strum' in shared));

var text = api.encodeSharedSong(shared);
var before = api.store().projects.length;
var beforeData = JSON.stringify(p.data);
var id = api.importSharedSong(api.decodeSharedSong('From my phone:\n' + text));
var q = api.activeProject();
check('pasting adds a new project and opens it', api.store().projects.length === before + 1 && q.id === id && api.store().activeId === id);
check('...with a name of its own (the original is still there)', q.name === 'Night Train 2');
check('...and the first project is untouched', JSON.stringify(p.data) === beforeData);
var d = q.data;
check('the key, meter, beat, bass range and tempo arrive', d.masterRootIndex === 7 && d.masterModeIndex === 5 && d.beatsPerBar === 3 && d.drumBeat === 'jazzwaltz' && d.bassWrapLow === 31 && d.tempo === 140);
check('...and this phone\'s own sound settings stay the defaults', d.instrument === 'epiano' && d.strum === 'off');
check('the sections arrive, renumbered from 1', JSON.stringify(d.sections.map(function (x) { return [x.id, x.name]; })) === JSON.stringify([[1, 'Verse'], [2, 'Chorus']]) && d.nextSectionId === 3);
check('every chord setting arrives', d.sections[0].blocks[0].third === 'sus4' && d.sections[0].blocks[1].appliedFunction === 'backdoor' && d.sections[1].blocks[0].freeRoot === 8);
check('the song order arrives: linked, own copy, independent box, linked',
  JSON.stringify(d.songSlots.map(function (x) { return [x.name, x.sourceSectionId, x.linked]; })) === JSON.stringify([['Verse', 1, true], ['Verse*', 1, false], ['Tag', null, false], ['Chorus', 2, true]]));
check('a linked box shows its section\'s chords; an own copy keeps its own', d.songSlots[0].blocks.length === 2 && d.songSlots[1].blocks[0].degreeIndex === 4);
check('the new project\'s blocks are copies, not shared with the text\'s', d.songSlots[0].blocks !== d.sections[0].blocks);
// Section ids are renumbered on arrival, so compare parts by their section's name.
function byName(song) {
  var name = {};
  song.sections.forEach(function (x) { name[x.id] = x.name; });
  return JSON.stringify({sections: song.sections.map(function (x) { return [x.name, x.blocks]; }), parts: song.parts.map(function (pt) { return [pt.section == null ? null : name[pt.section], pt.linked, pt.name, pt.blocks]; })});
}
check('sending it again gives the same song (a round trip changes nothing)',
  byName(api.decodeSharedSong(api.encodeSharedSong(api.projectToSharedSong(q)))) === byName(api.decodeSharedSong(text)));

// In Learn the project's own key is set aside; sending uses the song's key, not the lesson's.
api.switchToLearnHome();
api.openLesson(api.CURRICULUM[0].lessons[0].id);
check('(the lesson really has its own key)', api.state().masterRootIndex !== 7 || api.state().masterModeIndex !== 5);
var inLesson = api.projectToSharedSong(api.activeProject());
check('sent from Learn, the song keeps its own key', inLesson.rootIndex === 7 && inLesson.modeIndex === 5);

console.log(ok ? 'ALL PASSED' : 'SOME FAILED');
