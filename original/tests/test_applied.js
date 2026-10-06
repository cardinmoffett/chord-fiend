var fs = require('fs');
var code = fs.readFileSync('/home/claude/inner_regress.js','utf8');
function fakeEl(tag){ var el={style:{},className:'',children:[],addEventListener:function(){},appendChild:function(c){el.children.push(c);},classList:{add:function(){},remove:function(){},toggle:function(){}},querySelectorAll:function(){return[];}}; Object.defineProperty(el,'innerHTML',{set:function(){el.children=[];},get:function(){return '';}}); return el; }
global.window = {innerHeight: 800, addEventListener:function(){}};
var doc = { getElementById:function(){return fakeEl();}, createElement:function(t){return fakeEl(t);}, querySelectorAll:function(){return[];}, body:{appendChild:function(){}}, addEventListener:function(){} };
var ls = {getItem:function(){return null;}, setItem:function(){}};
var ToneMock = { start:function(){return {then:function(){return{catch:function(){}};}};}, Transport:{scheduleOnce:function(fn,t){fn(t);return 1;},scheduleRepeat:function(){return 1;},clear:function(){},bpm:{value:100},seconds:0,start:function(){},stop:function(){},cancel:function(){}}, Draw:{schedule:function(fn){fn();}} };
var api = new Function('document','localStorage','Tone', code + '\nreturn {buildChord:buildChord, defaultBlock:defaultBlock, getChordSymbol:getChordSymbol, appliedFunctionLabel:appliedFunctionLabel, chordTonePitch:chordTonePitch, DEGREE_NAMES:DEGREE_NAMES, pitchToNoteName:pitchToNoteName};')(doc, ls, ToneMock);
var ok = true;
function check(l,c){ console.log((c?'PASS':'FAIL')+'  '+l); if(!c) ok=false; }
function applied(overrides) { return Object.assign(api.defaultBlock(), {chordSource:"applied"}, overrides); }

console.log('=== Secondary Dominant: root is a 5th above the target, in C major ===');
// V7/ii (target=ii, index1): ii root = D(62); V7/ii root should be A(69) -- a 5th above D
var v7ii = api.buildChord(applied({appliedTargetIndex:1, appliedFunction:"dominant", extensionIndex:2}), 0, 0);
check('V7/ii root is A (69)', v7ii.chordRootPitch === 69);
check('V7/ii is a dominant 7th chord (maj3, P5, m7)', JSON.stringify(v7ii.offsets)===JSON.stringify([0,4,7,10]));
check('V7/ii chord symbol reads "A7"', api.getChordSymbol(v7ii) === api.pitchToNoteName(69) + "7");

// V7/V (target=V, index4): V root = G(67); V7/V root should be D(74) -- a 5th above G
var v7v = api.buildChord(applied({appliedTargetIndex:4, appliedFunction:"dominant", extensionIndex:2}), 0, 0);
check('V7/V root is D (74)', v7v.chordRootPitch === 74);

console.log('=== Tritone Sub: root is a half-step ABOVE the target ===');
// subV7/I (target=I, index0): I root = C(60); subV7/I root should be Db(61)
var subV7I = api.buildChord(applied({appliedTargetIndex:0, appliedFunction:"tritoneSub", extensionIndex:2}), 0, 0);
check('subV7/I root is Db (61), a half-step above C', subV7I.chordRootPitch === 61);
check('subV7/I is also dominant-7 quality', JSON.stringify(subV7I.offsets)===JSON.stringify([0,4,7,10]));

// Confirm the SHARED-TRITONE fact: V7/x and subV7/x contain the same tritone (3rd & 7th)
var v7I = api.buildChord(applied({appliedTargetIndex:0, appliedFunction:"dominant", extensionIndex:2}), 0, 0);
var v7ITritone = [v7I.pitches[1]%12, v7I.pitches[3]%12].sort();
var subV7ITritone = [subV7I.pitches[1]%12, subV7I.pitches[3]%12].sort();
check('V7/I and its tritone sub share the exact same tritone pitch classes', JSON.stringify(v7ITritone)===JSON.stringify(subV7ITritone));

console.log('=== Leading-Tone: fixed dim7, a half-step BELOW the target ===');
// vii°7/V (target=V, index4): V root = G(67); leading-tone root should be F#(66)
var lt = api.buildChord(applied({appliedTargetIndex:4, appliedFunction:"leadingTone"}), 0, 0);
check('leading-tone into V has root F# (66), a half-step below G', lt.chordRootPitch === 66);
check('leading-tone chord is a fully-diminished 7th (m3, dim5, dim7)', JSON.stringify(lt.offsets)===JSON.stringify([0,3,6,9]));
check('leading-tone chord symbol reads "dim7"', api.getChordSymbol(lt).indexOf('dim7') >= 0);

// Passing-diminished equivalence: half-step below target == half-step above the PRECEDING chord when they're a whole step apart (e.g. I to ii)
var passingIntoII = api.buildChord(applied({appliedTargetIndex:1, appliedFunction:"leadingTone"}), 0, 0); // target=ii(D,62) -> root should be C#(63)
check('passing chord into ii sits exactly between I (60) and ii (62)', passingIntoII.chordRootPitch === 61);

console.log('=== extension/sus/aug on applied dominant chords use FIXED intervals, not scale-derived ones ===');
var sus4Dom = api.buildChord(applied({appliedTargetIndex:0, appliedFunction:"dominant", susIndex:2, extensionIndex:2}), 0, 0); // sus4
check('sus4 on an applied dominant uses a fixed perfect 4th (+5)', sus4Dom.offsets[1] === 5);
var augDom = api.buildChord(applied({appliedTargetIndex:0, appliedFunction:"dominant", aug:true}), 0, 0);
check('aug on an applied dominant raises the 5th to +8', augDom.offsets[2] === 8);

console.log('=== leading-tone ignores extension/sus/aug entirely (always the fixed tetrad) ===');
var ltWithExtras = api.buildChord(applied({appliedTargetIndex:4, appliedFunction:"leadingTone", susIndex:2, aug:true, extensionIndex:5}), 0, 0);
check('leading-tone chord is unaffected by sus/aug/extension settings', JSON.stringify(ltWithExtras.offsets)===JSON.stringify([0,3,6,9]));
check('...and reports them as off/none in the returned chord object', ltWithExtras.sus==='none' && ltWithExtras.aug===false);

console.log('=== bass chord-tone-slot system composes naturally with applied chords ===');
check('slot 0 (root) of an applied dominant IS its own (applied) root', api.chordTonePitch(v7ii, 0) === v7ii.chordRootPitch);
check('slot 3 (7th) of the applied dominant is the actual b7, not clamped (offsets has 4 entries)', api.chordTonePitch(v7ii, 3) === v7ii.chordRootPitch + 10);
var triadApplied = api.buildChord(applied({appliedTargetIndex:1, appliedFunction:"dominant", extensionIndex:0}), 0, 0); // plain triad, no 7th
check('slot 3 (7th) clamps to root when the applied chord is a plain triad', api.chordTonePitch(triadApplied, 3) === triadApplied.chordRootPitch);

console.log('=== functional label ===');
check('appliedFunctionLabel reads naturally', api.appliedFunctionLabel(applied({appliedTargetIndex:1, appliedFunction:"dominant"})) === "Dominant of ii");
check('...for tritone sub', api.appliedFunctionLabel(applied({appliedTargetIndex:0, appliedFunction:"tritoneSub"})) === "Tritone sub of I");

console.log('=== diatonic path is completely unaffected (backward compatibility) ===');
var plainC = api.buildChord(api.defaultBlock(), 0, 0);
check('a plain default (diatonic) block still gives C major triad', plainC.chordRootPitch===60 && JSON.stringify(plainC.offsets)===JSON.stringify([0,4,7]));
check('diatonic chord reports isApplied:false', plainC.isApplied === false);
check('applied chord reports isApplied:true', v7ii.isApplied === true);

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
