// Hand-checked expectations for sectionToNotes, written from how the app plays a
// section (see the comment at the top of src/notes.js), not from the code under test.
import { defaultBlock } from '../src/engine.js';
import { sectionToNotes } from '../src/notes.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
function blk(o) { return Object.assign(defaultBlock(), o); }
function pitches(list) { return list.map(function (n) { return n.pitch; }); }
function starts(list) { return list.map(function (n) { return n.start; }); }

// I - V in C major, one bar (1/1) each, Basic Rock.
var IV = [blk({degreeIndex: 0}), blk({degreeIndex: 4})];
var r = sectionToNotes(IV, {rootIndex: 0, modeIndex: 0, drumBeat: 'rock'});

console.log('=== chords ===');
check('section is 8 beats', r.lengthBeats, 8);
check('blocks start at 0 and 4', r.blockStarts, [0, 4]);
check('C major triad then G major triad', pitches(r.chords), [60, 64, 67, 67, 71, 74]);
check('each chord holds for its whole bar', r.chords.map(function (n) { return [n.start, n.duration]; }), [[0, 4], [0, 4], [0, 4], [4, 4], [4, 4], [4, 4]]);

console.log('\n=== bass (rock: root on every beat, wrapped into the octave from E1 = 28) ===');
check('C root lands on C2 (36), G root on G1 (31)', pitches(r.bass), [36, 36, 36, 36, 31, 31, 31, 31]);
check('one note per beat', starts(r.bass), [0, 1, 2, 3, 4, 5, 6, 7]);
check('each a beat long', r.bass.map(function (n) { return n.duration; }), [1, 1, 1, 1, 1, 1, 1, 1]);
var low = sectionToNotes(IV, {drumBeat: 'rock', bassWrapLow: 40});
check('a higher bass lowest note moves the line up: C3 (48) and G2 (43)', pitches(low.bass).filter(function (p, i) { return i % 4 === 0; }), [48, 43]);

console.log('\n=== bass edge cases ===');
var half = sectionToNotes([blk({durationIndex: 3})], {drumBeat: 'hiphop'}); // a 2-beat block, hip-hop bass hits at 0, 1.5, 2.5
check('a hit past the block end is skipped, and one that would overrun is cut short', half.bass.map(function (n) { return [n.start, n.duration]; }), [[0, 1.5], [1.5, 0.5]]);
var two = sectionToNotes([blk({durationIndex: 1})], {drumBeat: 'halftime'}); // an 8-beat block, half-time bass at 0 and 2 (2 beats each)
check('a block longer than the pattern repeats it', starts(two.bass), [0, 2, 4, 6]);
var off = sectionToNotes([blk({bassToneIndex: -1}), blk({degreeIndex: 4})], {drumBeat: 'rock'});
check('bass off for one block leaves only the other block', starts(off.bass), [4, 5, 6, 7]);
check('bassEnabled false means no bass at all', sectionToNotes(IV, {bassEnabled: false}).bass.length, 0);
var withSeventh = sectionToNotes([blk({degreeIndex: 4, extensionIndex: 2})], {drumBeat: 'rock', customBeatPatterns: {rock: {label: 'x', loopBeats: 4, lanes: [{voice: 'bass1', hits: [{beat: 0, dur: 1}]}, {voice: 'bass7', hits: [{beat: 1, dur: 1}]}]}}});
check('an edited beat with a 7th lane plays the chord\'s own 7th (G7: G1 31, F2 41)', pitches(withSeventh.bass), [31, 41]);

console.log('\n=== drums (rock: kick 0 and 2, snare 1 and 3, hi-hat every eighth; General MIDI notes) ===');
var bar1 = r.drums.filter(function (n) { return n.start < 4; });
check('kicks', starts(bar1.filter(function (n) { return n.pitch === 36; })), [0, 2]);
check('snares', starts(bar1.filter(function (n) { return n.pitch === 38; })), [1, 3]);
check('hi-hats', starts(bar1.filter(function (n) { return n.pitch === 42; })), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
check('the second bar repeats the first', starts(r.drums.filter(function (n) { return n.start >= 4; })).map(function (b) { return b - 4; }), starts(bar1));
check('hits are a sixteenth long', r.drums.every(function (n) { return n.duration === 0.25; }), true);
check('a custom drum map is used', pitches(sectionToNotes(IV, {drumMap: {kick: 48}}).drums.filter(function (n) { return n.start === 0; })), [42, 48]);
check('drums run from the section start across block lengths (a 6-beat section: kicks at 0, 2, 4)', starts(sectionToNotes([blk({durationIndex: 3}), blk({})], {}).drums.filter(function (n) { return n.pitch === 36; })), [0, 2, 4]);
check('beat "off" means no drums', sectionToNotes(IV, {drumBeat: 'off'}).drums.length, 0);

console.log(ok ? '\nALL PASSED' : '\nSOME FAILED');
