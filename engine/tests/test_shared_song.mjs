// Sharing a song between the phone and Live: the text survives the trip unchanged, can be
// found in whatever was pasted around it, and anything that isn't a whole song is refused
// with a message a person can act on. Damaged or partial songs are made safe.
import { defaultBlock, encodeSharedSong, decodeSharedSong, normalizeSharedSong, describeSharedSong, SHARED_SONG_VERSION } from '../src/engine.js';

var ok = true;
function check(label, actual, expected) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + label + (pass ? '' : '\n      got      ' + JSON.stringify(actual) + '\n      expected ' + JSON.stringify(expected)));
  if (!pass) ok = false;
}
function throwsWith(label, fn, words) {
  var msg = null;
  try { fn(); } catch (e) { msg = e.message; }
  check(label, msg !== null && msg.indexOf(words) >= 0, true);
}
var blk = function (o) { return Object.assign(defaultBlock(), o); };

var SONG = {
  name: 'Café Blues ♭ 🎸', rootIndex: 2, modeIndex: 1, beatsPerBar: 3, drumBeat: 'jazzwaltz', bassWrapLow: 30, tempo: 132,
  sections: [
    {id: 1, name: 'Verse', blocks: [blk({degreeIndex: 1, extensionIndex: 2}), blk({chordSource: 'applied', appliedFunction: 'mediant', appliedTargetIndex: 3})]},
    {id: 2, name: 'Chorus', blocks: [blk({chordSource: 'free', freeRoot: 6, seventh: 'b7'})]}
  ],
  parts: [
    {section: 1, linked: true},
    {section: 1, name: 'Verse*', blocks: [blk({degreeIndex: 4})], linked: false},
    {section: null, name: 'Bridge', blocks: [blk({degreeIndex: 5})], linked: false},
    {section: 2, linked: true}
  ]
};

var text = encodeSharedSong(SONG);
check('the text starts with a readable line', text.split('\n')[0], 'Theoryaoke song: Café Blues ♭ 🎸 — Verse, Chorus (paste into Theoryaoke)');
check('the data line is tagged with the version and ends with a full stop', /^theoryaoke:1:[A-Za-z0-9+\/=]+\.$/.test(text.split('\n')[1]), true);
var back = decodeSharedSong(text);
check('it comes back exactly (names with accents and emoji, every block field, every part)', back, normalizeSharedSong(SONG));
check('...including the tempo', back.tempo, 132);
check('...and the blocks are whole blocks', Object.keys(back.sections[1].blocks[0]).sort(), Object.keys(blk({chordSource: 'free', freeRoot: 6, seventh: 'b7'})).sort());

var data = text.split('\n')[1];
check('found inside other text (a message around it)', decodeSharedSong('Here you go:\n\n' + text + '\n\nSent from my iPhone'), back);
check('found with line breaks and spaces put into the data', decodeSharedSong(data.slice(0, 30) + '\n  ' + data.slice(30, 61) + ' \r\n' + data.slice(61)), back);
throwsWith('ordinary text is refused, saying how to get a song', function () { decodeSharedSong('Verse: C G Am F'); }, 'Send to Live');
throwsWith('a copy cut short is refused', function () { decodeSharedSong(data.slice(0, data.length - 20)); }, 'whole');
throwsWith('damaged data is refused', function () { decodeSharedSong('theoryaoke:1:bm90IGpzb24=.'); }, 'whole');
throwsWith('a song from a newer version asks to update', function () { decodeSharedSong('theoryaoke:' + (SHARED_SONG_VERSION + 1) + ':e30=.'); }, 'newer');

// Damaged or partial songs are made safe.
var n = normalizeSharedSong({sections: [{id: 7, name: 'A', blocks: []}, null], parts: [{section: 7, linked: true}, {section: 99, linked: true}, {section: 99, name: 'Lost', blocks: [{degreeIndex: 3}]}, {name: 'Empty', blocks: []}], rootIndex: 40, modeIndex: -3, beatsPerBar: 7, drumBeat: 'waltz'});
check('a section with no chords gets one', n.sections[0].blocks.length, 1);
check('a link to a missing section is dropped; an own copy is kept without its section; an empty part is dropped', n.parts.map(function (p) { return [p.section, p.linked]; }), [[7, true], [null, false]]);
check('a block with missing fields is completed', n.parts[1].blocks[0].durationIndex, defaultBlock().durationIndex);
check('key and mode are kept in range, an odd meter is 4/4, and a beat from another meter becomes the default', [n.rootIndex, n.modeIndex, n.beatsPerBar, n.drumBeat], [11, 0, 4, 'rock']);
check('no tempo is left out, not invented', 'tempo' in n, false);
throwsWith('a song with nothing in it is refused', function () { normalizeSharedSong({sections: [], parts: []}); }, 'nothing');

check('the one-line summary', describeSharedSong(back), 'Verse, Chorus · 4 parts · D Dorian · 3/4');
check('...spelled with flats in a flat key', describeSharedSong(Object.assign({}, back, {rootIndex: 3, modeIndex: 0, beatsPerBar: 4})).split(' · ')[2], 'E♭ Ionian');

if (!ok) { console.log('\nSOME FAILED'); process.exit(1); }
console.log('\nALL PASSED');
