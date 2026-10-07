// Chord Fiend chord engine.
//
// Extracted from original/modal-sketchpad.html (the 2026-10-04 snapshot). The code
// below is the app's own, copied line for line, with one kind of change: the five
// functions that read app-wide `state` now take those values as parameters.
//
//   getChordSymbol(chord, masterRootIndex)
//   appliedFunctionLabel(block, masterModeIndex)
//   bassOctaveShift(rootPitch, bassWrapLow)
//   computeBassPitchForBlock(block, chord, pattern, bassWrapLow)
//   activeBeatPattern(beatKey, customBeatPatterns)
//
// Two additions the app never had, both optional block fields, so a block without
// them builds exactly as the app's did:
//
//   flat5        lowers the chord's 5th a semitone (a ♭5), on any chord source
//   chordSource "free", with freeRoot (pitch class 0-11) and freeQuality
//                ("major" | "minor" | "dominant" | "diminished"): a chord on any root, not tied
//                to the key's scale, that takes every extension and voicing option
//
// Nothing here touches the DOM, audio, storage or timers.
// tests/test_matches_original.mjs checks that it gives the same answers as the app.

var MODES = {
  "Ionian":          [0,2,4,5,7,9,11],
  "Dorian":          [0,2,3,5,7,9,10],
  "Phrygian":        [0,1,3,5,7,8,10],
  "Lydian":          [0,2,4,6,7,9,11],
  "Mixolydian":      [0,2,4,5,7,9,10],
  "Aeolian":         [0,2,3,5,7,8,10],
  "Locrian":         [0,1,3,5,6,8,10],
  "HarmonicMinor":   [0,2,3,5,7,8,11],
  "MelodicMinor":    [0,2,3,5,7,9,11],
  "PhrygianDominant":[0,1,4,5,7,8,10]
};

var DEGREE_NAMES = ["I","ii","iii","IV","V","vi","vii"];
var DEGREE_INDEX = {"I":0,"ii":1,"iii":2,"IV":3,"V":4,"vi":5,"vii":6};
var BLOCK_MODE_NAMES = ["Thru","Ionian","Dorian","Phrygian","Lydian","Mixolydian","Aeolian","Locrian","HarmonicMinor","MelodicMinor","PhrygianDominant"];
var MASTER_MODE_NAMES = ["Ionian","Dorian","Phrygian","Lydian","Mixolydian","Aeolian","Locrian","HarmonicMinor","MelodicMinor","PhrygianDominant"];
var EXTENSION_NAMES = ["triad","6","7","9","11","13"];
var EXTENSION_TONE_COUNT = {"triad":3,"7":4,"9":5,"11":6,"13":7};
var SUS_NAMES = ["none","sus2","sus4"];
var DROP_NAMES = ["Close","Drop 2","Drop 3","Drop 2+4"];
var NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
var NOTE_NAMES_FLAT = ["C","D\u266D","D","E\u266D","E","F","G\u266D","G","A\u266D","A","B\u266D","B"];
// Which reference major-key root (by pitch class) is conventionally spelled
// with flats, per the circle of fifths (F, Bb, Eb, Ab, Db -- and enharmonic
// Gb/F# is treated as sharp-side here since F# major is the far more common
// spelling in practice).
var FLAT_PREFERRING_MAJOR_ROOT = [false,true,false,true,false,true,false,false,true,false,true,false];
// Semitones to SUBTRACT from a mode's own root to find the reference major
// key whose sharp/flat convention that mode follows. Church modes map to a
// rotation of the major scale (e.g. Aeolian is degree 6, so subtract 9);
// HarmonicMinor and MelodicMinor conventionally keep natural minor's own
// key signature (same offset as Aeolian), with their raised degrees written
// as accidentals rather than changing the signature. PhrygianDominant is
// the 5th mode of harmonic minor, derived the same way (verified directly
// against the circle of fifths, not assumed).
var MASTER_MODE_RELATIVE_MAJOR_OFFSET = [0, 2, 4, 5, 7, 9, 11, 9, 9, 4];
function keyPrefersFlats(rootIndex, modeIndex) {
  var offset = MASTER_MODE_RELATIVE_MAJOR_OFFSET[modeIndex];
  var refRoot = ((rootIndex - offset) % 12 + 12) % 12;
  return FLAT_PREFERRING_MAJOR_ROOT[refRoot];
}
var NOTE_NAME_TO_OFFSET = {"C":0,"C#":1,"D":2,"D#":3,"E":4,"F":5,"F#":6,"G":7,"G#":8,"A":9,"A#":10,"B":11};
var DURATION_NAMES = ["4/1","2/1","1/1","1/2","1/4","1/8","1/16"];
var DURATION_BEATS = {"4/1":16,"2/1":8,"1/1":4,"1/2":2,"1/4":1,"1/8":0.5,"1/16":0.25};
var DURATION_MODIFIER_NAMES = ["Straight","Dotted","Triplet"];

function buildExtendedScale(modeIntervals, length) {
  var out = [];
  for (var i = 0; i < length; i++) {
    var lap = Math.floor(i / 7), step = i % 7;
    out.push(modeIntervals[step] + lap * 12);
  }
  return out;
}

// "Drop 2" means: lower the SECOND-HIGHEST sounding note by an octave (Drop 3:
// the third-highest; Drop 2+4: second- and fourth-highest). That is defined
// against the chord's close voicing in PITCH order. The notes arrive here in
// TONE order, though -- an inversion lifts its lowest tones an octave without
// re-sorting -- so counting from the end of the array lowered whichever TONE
// was second from last, not whichever NOTE was second from the top. On an
// inverted chord that was the wrong note: Drop 2 on a first-inversion C triad
// (E G C) lowered the E instead of the G, and Drop 3 undid the inversion
// altogether. Sorting first makes "from the top" mean from the top.
function applyDrops(pitches, dropIndex) {
  var p = pitches.slice().sort(function (a,b) { return a-b; }), n = p.length;
  function dropAt(fromTop) { var idx = n - fromTop; if (idx >= 0 && idx < n) p[idx] -= 12; }
  if (dropIndex === 1) dropAt(2);
  else if (dropIndex === 2) dropAt(3);
  else if (dropIndex === 3) { dropAt(2); dropAt(4); }
  p.sort(function (a,b) { return a-b; });
  return p;
}

// Roman-numeral labels for the seven degrees of a mode, derived from the
// mode's own scale so they always match what the chord engine plays:
//   - case shows quality (UPPER = major, lower = minor)
//   - ° = diminished, + = augmented
//   - a flat/sharp shows where the root sits against the parallel major, the
//     standard frame for modal interchange (Aeolian: i ii° ♭III iv v ♭VI ♭VII)
var ROMAN_BASE = ["I", "II", "III", "IV", "V", "VI", "VII"];
function degreeLabels(modeName) {
  var mode = MODES[modeName];
  var major = MODES["Ionian"];
  var labels = [];
  for (var d = 0; d < 7; d++) {
    var root = mode[d];
    // the triad stacked in thirds from this degree, wrapping into the next octave
    var third = mode[(d + 2) % 7] + (d + 2 >= 7 ? 12 : 0);
    var fifth = mode[(d + 4) % 7] + (d + 4 >= 7 ? 12 : 0);
    var t = third - root, f = fifth - root;
    var numeral = ROMAN_BASE[d];
    if (t === 3) numeral = numeral.toLowerCase();          // minor or diminished
    var suffix = "";
    if (t === 3 && f === 6) suffix = "\u00B0";             // diminished
    else if (t === 4 && f === 8) suffix = "+";             // augmented
    var shift = root - major[d];
    var accidental = shift < 0 ? "\u266D" : (shift > 0 ? "\u266F" : "");
    labels.push(accidental + numeral + suffix);
  }
  return labels;
}

function buildChord(block, masterRootIndex, masterModeIndex) {
  var blockModeName = BLOCK_MODE_NAMES[block.blockModeIndex];
  var isThru = blockModeName === "Thru";
  var resolvedMode = isThru ? MASTER_MODE_NAMES[masterModeIndex] : blockModeName;
  var modeIntervals = MODES[resolvedMode];

  var extensionName = EXTENSION_NAMES[block.extensionIndex];
  var is6 = extensionName === "6";
  var toneCount = is6 ? 3 : EXTENSION_TONE_COUNT[extensionName];
  var susName = SUS_NAMES[block.susIndex];

  var isApplied = block.chordSource === "applied";
  var isFree = block.chordSource === "free";
  var fn = isApplied ? (block.appliedFunction || "dominant") : null;
  var degreeIndex, chordRootOffset, offsets;
  var effectiveSus = susName, effectiveAug = !!block.aug, effectiveIs6 = is6;
  var effectiveFlat5 = !block.aug && !!block.flat5;

  if (isFree) {
    // FREE: a root anywhere, measured up from the key's root so the octave
    // setting means the same as for every other block, with a fixed quality.
    var quality = FREE_QUALITY_INTERVALS[block.freeQuality] ? block.freeQuality : "major";
    var qualityIntervals = FREE_QUALITY_INTERVALS[quality];
    degreeIndex = -1; // not a degree of the key
    chordRootOffset = (((block.freeRoot || 0) - masterRootIndex) % 12 + 12) % 12;
    offsets = is6 ? qualityIntervals.slice(0, 3).concat([9]) : qualityIntervals.slice(0, toneCount);
    if (susName === "sus2") offsets[1] = 2;
    else if (susName === "sus4") offsets[1] = 5;
    if (block.aug) offsets[2] = 8;
    else if (effectiveFlat5) offsets[2] = 6;
  } else if (isApplied) {
    // The target's OWN diatonic root -- same scale-walk the plain diatonic
    // path below uses, just to locate where the target sits, not to shape
    // the applied chord's own quality (that's fixed by the function).
    var targetIndex = block.appliedTargetIndex || 0;
    var targetExtended = buildExtendedScale(modeIntervals, targetIndex + 8);
    var targetRootOffset = targetExtended[targetIndex];
    degreeIndex = targetIndex; // reused below for pitch base + display

    if (fn === "leadingTone") {
      chordRootOffset = targetRootOffset - 1; // a half-step below the target
      offsets = DIMINISHED7_INTERVALS.slice(); // always this exact tetrad
      effectiveSus = "none"; effectiveAug = false; effectiveIs6 = false; // not meaningful on a fixed dim7
      effectiveFlat5 = false; // already has one
    } else {
      chordRootOffset = targetRootOffset + (fn === "tritoneSub" ? 1 : 7);
      if (is6) {
        offsets = DOMINANT_INTERVALS.slice(0, 3).concat([9]); // triad + a plain major 6th
      } else {
        offsets = DOMINANT_INTERVALS.slice(0, toneCount);
        if (susName === "sus2") offsets[1] = 2; // fixed major 2nd -- not scale-derived, dominant quality is fixed
        else if (susName === "sus4") offsets[1] = 5; // fixed perfect 4th
        if (block.aug) offsets[2] = 8;
        else if (effectiveFlat5) offsets[2] = 6;
      }
    }
  } else {
    var degree = DEGREE_NAMES[block.degreeIndex];
    degreeIndex = DEGREE_INDEX[degree];
    var extended = buildExtendedScale(modeIntervals, degreeIndex + Math.max(toneCount,4)*2 + 7);
    chordRootOffset = extended[degreeIndex];
    offsets = [];
    for (var k = 0; k < toneCount; k++) offsets.push(extended[degreeIndex + k*2] - chordRootOffset);
    if (susName === "sus2") offsets[1] = extended[degreeIndex+1] - chordRootOffset;
    else if (susName === "sus4") offsets[1] = extended[degreeIndex+3] - chordRootOffset;
    if (block.aug) offsets[2] = 8;
    else if (effectiveFlat5) offsets[2] = 6;
    if (is6) offsets.push(extended[degreeIndex+5] - chordRootOffset);
  }

  var base = 60 + NOTE_NAME_TO_OFFSET[NOTE_NAMES[masterRootIndex]] + block.octave*12;
  var chordRootPitch = base + chordRootOffset;
  // Each tone keeps its label through the sort, so toneLabels[i] always
  // names exactly the note that is i-th from the bottom in root position --
  // which is also exactly what inversion i puts in the bass.
  var roles = chordToneRoles(offsets.length, effectiveSus, effectiveIs6);
  var tones = offsets.map(function (o, i) {
    return {pitch: chordRootPitch + o, label: chordToneLabel(o, roles[i])};
  });
  tones.sort(function (a, b) { return a.pitch - b.pitch; });
  var pitches = tones.map(function (t) { return t.pitch; });
  var toneLabels = tones.map(function (t) { return t.label; });

  var maxInv = Math.max(0, pitches.length-1);
  var inv = Math.min(Math.max(block.inversion||0,0), maxInv);
  // Inversion i puts tone i in the bass: every tone below it moves up an
  // octave. For ordinary chords one octave always clears it. The 9th, 11th
  // and 13th are the exception -- they sit more than an octave above the root
  // (14, 17, 21 semitones), so the root lifted a single octave (12) still
  // lands BELOW a 9th, and "9 in the bass" used to play the root. Keep lifting
  // until the chosen tone really is the lowest note, so the label is true.
  var bassPitch = pitches[inv];
  for (var n = 0; n < inv; n++) {
    pitches[n] += 12;
    while (pitches[n] <= bassPitch) pitches[n] += 12;
  }

  pitches = applyDrops(pitches, block.dropIndex||0);

  return {pitches:pitches, chordRootPitch:chordRootPitch, offsets:offsets, toneLabels:toneLabels, inversion:inv, sus:effectiveSus, aug:effectiveAug, is6:effectiveIs6,
          dropIndex:block.dropIndex||0, resolvedMode:resolvedMode, isThru:isThru,
          chordDegreeIndex:degreeIndex, blockOctave:block.octave,
          isApplied:isApplied, appliedFunction:fn,
          isFree:isFree, flat5:effectiveFlat5 && offsets[2] === 6};
}

function pitchToNoteName(pitch, preferFlats) { return (preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES)[((pitch%12)+12)%12]; }
function pitchToFullNoteName(pitch) { return pitchToNoteName(pitch) + (Math.floor(pitch / 12) - 1); }

// A dropdown for CHOOSING a note has to offer both names of a black key --
// pitch class 1 is C-sharp to one player and D-flat to another, and a list that
// only says one reads as though the other isn't there. (This is just the label:
// each option's value, and so everything saved or played, is the same number.)
function noteChoiceLabel(pitchClass, octave) {
  var oct = octave === undefined ? "" : String(octave);
  var sharp = NOTE_NAMES[pitchClass].replace("#", "\u266F");
  var flat = NOTE_NAMES_FLAT[pitchClass];
  return sharp === flat ? sharp + oct : sharp + oct + "/" + flat + oct;
}

function getChordSymbol(chord, masterRootIndex) {
  // Anchored at the HOME root but using the CHORD's OWN effective mode
  // (resolvedMode already correctly reflects a borrowed mode, not just the
  // home one) -- this is what makes a borrowed bVI spell as Ab even in a
  // sharp-leaning major home key, since Aeolian's own relative-major offset
  // governs it, not the home key's. Tritone substitutions are a stronger,
  // near-universal exception to that: they're conventionally always written
  // with flats regardless of the surrounding key, since the whole function
  // of the chord is named and recognized by its flat-side spelling (Db7, Gb7),
  // so that overrides the general rule here.
  var preferFlats = chord.isApplied && chord.appliedFunction === "tritoneSub"
    ? true
    : keyPrefersFlats(masterRootIndex, MASTER_MODE_NAMES.indexOf(chord.resolvedMode));
  var rootName = pitchToNoteName(chord.chordRootPitch, preferFlats);
  var o = chord.offsets, third=o[1], fifth=o[2], seventh = o.length>3 && !chord.is6 ? o[3] : undefined;
  var base;
  if (chord.sus === "sus2" || chord.sus === "sus4") {
    var d = chord.is6?"6":(o.length===4?"7":o.length===5?"9":o.length===6?"11":o.length===7?"13":"");
    base = rootName + d + chord.sus + (chord.flat5 ? "b5" : "");
  } else {
    var q;
    if (chord.aug) q = "aug";
    else if (third===4 && fifth===7) q = "maj";
    else if (third===3 && fifth===7) q = "min";
    else if (third===3 && fifth===6) q = "dim";
    else if (third===4 && fifth===8) q = "aug";
    else if (third===4 && fifth===6) q = "b5";
    else q = "?";
    if (chord.is6) base = q==="maj" ? rootName+"6" : q==="min" ? rootName+"m6" : q==="b5" ? rootName+"6(b5)" : rootName+q+"6";
    else if (o.length===3) base = q==="maj"?rootName : q==="min"?rootName+"m" : q==="dim"?rootName+"dim" : q==="aug"?rootName+"aug" : q==="b5"?rootName+"(b5)" : rootName+"?";
    else {
      var d2 = o.length===4?"7":o.length===5?"9":o.length===6?"11":o.length===7?"13":"";
      if (q==="maj" && seventh===11) base = rootName+"maj"+d2;
      else if (q==="maj" && seventh===10) base = rootName+d2;
      else if (q==="min" && seventh===10) base = rootName+"m"+d2;
      else if (q==="min" && seventh===11) base = rootName+"m(maj"+d2+")";
      else if (q==="dim" && seventh===9) base = rootName+"dim"+d2;
      else if (q==="dim" && seventh===10) base = rootName+"m"+d2+"b5";
      else if (q==="aug" && seventh===11) base = rootName+"maj"+d2+"#5";
      else if (q==="b5" && seventh===10) base = rootName+d2+"b5";
      else if (q==="b5" && seventh===11) base = rootName+"maj"+d2+"b5";
      else base = rootName+"?"+d2;
    }
  }
  if (chord.dropIndex > 0) base += " (" + DROP_NAMES[chord.dropIndex] + ")";
  return base;
}

function getDurationBeats(block) {
  var base = DURATION_BEATS[DURATION_NAMES[block.durationIndex]];
  if (block.durationModifier === 1) return base * 1.5;
  if (block.durationModifier === 2) return base * (2/3);
  return base;
}

// bassToneIndex: -1 = Off, -2 = Random (among this chord's own tones), 0+ = a
// specific tone index into the chord's functional tones (root, then upward),
// clamped to however many tones this particular chord actually has.
function defaultBlock() {
  return {degreeIndex:0, blockModeIndex:0, extensionIndex:0, susIndex:0, aug:0, inversion:0, octave:0,
          dropIndex:0, durationIndex:2, durationModifier:0, bassToneIndex:0,
          chordSource:"diatonic", appliedTargetIndex:0, appliedFunction:"dominant"};
}

// APPLIED CHORDS: a second way to build a block's root and quality, sitting
// next to the diatonic (degree-in-a-mode) system rather than replacing it.
// A diatonic chord's root always comes from walking the current mode's own
// scale. An applied chord deliberately ignores that -- its root is fixed
// relative to a TARGET degree (still the same I/ii/iii/IV/V/vi/vii
// vocabulary), and its quality is fixed by which FUNCTION is chosen, not
// derived from the scale at all:
//   - Dominant of <target>: the dominant 7th a 5th above the target's own
//     root -- resolves DOWN a 5th into it (a secondary dominant).
//   - Tritone sub of <target>: the dominant 7th a half-step ABOVE the
//     target -- shares its tritone with the plain secondary dominant, but
//     resolves DOWN a half-step instead of a 5th.
//   - Leading-tone into <target>: a fixed, fully-diminished 7th a half-step
//     BELOW the target -- doubles as the classic chromatic passing chord
//     between two diatonic chords a whole step apart.
var APPLIED_FUNCTIONS = ["dominant", "tritoneSub", "leadingTone"];
var APPLIED_FUNCTION_LABELS = {dominant: "Dominant of", tritoneSub: "Tritone sub of", leadingTone: "Leading-tone into"};
var DOMINANT_INTERVALS = [0, 4, 7, 10, 14, 17, 21]; // root, 3rd, 5th, b7, 9th, 11th, 13th
var DIMINISHED7_INTERVALS = [0, 3, 6, 9]; // root, m3, dim5, dim7 -- always this exact tetrad
// FREE chords (an addition, not from the app): stacked thirds for each quality, up to the 13th.
// Diminished stacks a fully diminished 7th (bb7 = 9), then the 9th, 11th and b13.
var FREE_QUALITIES = ["major", "minor", "dominant", "diminished"];
var FREE_QUALITY_INTERVALS = {major: [0, 4, 7, 11, 14, 17, 21], minor: [0, 3, 7, 10, 14, 17, 21], dominant: DOMINANT_INTERVALS, diminished: [0, 3, 6, 9, 14, 17, 20]};

// ---- Chord-degree names (1, 3, 5, 7, 9...) --------------------------------
// Every tone of a chord has a ROLE (which numbered degree of the chord it is)
// and a semitone distance from the root. The label is the role number, with
// a flat or sharp when that distance differs from the plain MAJOR-scale
// version of that role -- which is exactly how chord tones are named in
// practice: a minor third is b3, an augmented fifth is #5, a diminished
// seventh is bb7, a Phrygian ninth is b9, a Lydian eleventh is #11.
var CHORD_DEGREE_REFERENCE = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21};
var STACKED_THIRD_ROLES = [1, 3, 5, 7, 9, 11, 13];
function chordToneLabel(offset, role) {
  var diff = offset - CHORD_DEGREE_REFERENCE[role];
  var mark = "";
  for (var i = 0; i < Math.abs(diff); i++) mark += diff < 0 ? "\u266D" : "\u266F";
  return mark + role;
}
// Which role each tone plays, in the same order as the chord's offsets. A
// sus chord swaps its third for a 2nd or 4th, and a "6" chord's extra tone
// is a 6th rather than the next stacked third -- the cases where the old
// plain position numbers (0, 1, 2...) said nothing about what was happening.
function chordToneRoles(toneCount, sus, is6) {
  var roles = is6 ? [1, 3, 5, 6] : STACKED_THIRD_ROLES.slice(0, toneCount);
  if (sus === "sus2") roles[1] = 2;
  else if (sus === "sus4") roles[1] = 4;
  return roles;
}

function appliedFunctionLabel(block, masterModeIndex) {
  // An applied chord's target is always a position in the HOME key's own
  // diatonic scale (never the block's own borrowed mode, since this block
  // IS the applied chord, not a "Thru" or borrowed one) -- so its label
  // must reflect the master mode, not a fixed major-key array. Without
  // this, a minor-key lesson's "Dominant of i" would incorrectly show as
  // uppercase "Dominant of I", same mismatch degreeLabels already solves
  // for the plain Degree field elsewhere.
  var homeMode = MASTER_MODE_NAMES[masterModeIndex];
  return APPLIED_FUNCTION_LABELS[block.appliedFunction] + " " + degreeLabels(homeMode)[block.appliedTargetIndex];
}

/* ============================================================
   STATE
   ============================================================ */

//
// Bass lanes reference the CHORD'S OWN already-computed tones (root, 3rd-
// or-sus, 5th-or-augmented, 7th), not an abstract scale degree -- so a bass
// row tracks sus/aug the same way the chord notes above it do. The 7th
// clamps to the root when the chord is a plain triad with nothing there.
// ============================================================
var BASS_VOICES = ["bass1", "bass3", "bass5", "bass7"]; // voice -> chord.offsets slot index
function bassSlotForVoice(voice) {
  return BASS_VOICES.indexOf(voice);
}

// Built-ins are the fallback for any beat a project hasn't customized.
// Bass content here is root-only for now (no octave, per an earlier
// decision) -- the editor is what lets a beat's bassline grow beyond that.
var BUILTIN_BEAT_PATTERNS = {
  rock: {
    label: "Basic Rock", loopBeats: 4, lanes: [
      {voice:"kick", hits:[{beat:0,dur:0.25}, {beat:2,dur:0.25}]},
      {voice:"snare", hits:[{beat:1,dur:0.25}, {beat:3,dur:0.25}]},
      {voice:"hihat", hits:[{beat:0,dur:0.25}, {beat:0.5,dur:0.25}, {beat:1,dur:0.25}, {beat:1.5,dur:0.25}, {beat:2,dur:0.25}, {beat:2.5,dur:0.25}, {beat:3,dur:0.25}, {beat:3.5,dur:0.25}]},
      {voice:"bass1", hits:[{beat:0,dur:1}, {beat:1,dur:1}, {beat:2,dur:1}, {beat:3,dur:1}]},
      {voice:"bass3", hits:[]}, {voice:"bass5", hits:[]}, {voice:"bass7", hits:[]}
    ]
  },
  fourfloor: {
    label: "Four on the Floor", loopBeats: 4, lanes: [
      {voice:"kick", hits:[{beat:0,dur:0.25}, {beat:1,dur:0.25}, {beat:2,dur:0.25}, {beat:3,dur:0.25}]},
      {voice:"snare", hits:[{beat:1,dur:0.25}, {beat:3,dur:0.25}]},
      {voice:"hihat", hits:[{beat:0,dur:0.25}, {beat:0.5,dur:0.25}, {beat:1,dur:0.25}, {beat:1.5,dur:0.25}, {beat:2,dur:0.25}, {beat:2.5,dur:0.25}, {beat:3,dur:0.25}, {beat:3.5,dur:0.25}]},
      {voice:"bass1", hits:[{beat:0,dur:1}, {beat:1,dur:1}, {beat:2,dur:1}, {beat:3,dur:1}]},
      {voice:"bass3", hits:[]}, {voice:"bass5", hits:[]}, {voice:"bass7", hits:[]}
    ]
  },
  hiphop: {
    label: "Hip-Hop", loopBeats: 4, lanes: [
      {voice:"kick", hits:[{beat:0,dur:0.25}, {beat:1.5,dur:0.25}, {beat:2.5,dur:0.25}]},
      {voice:"snare", hits:[{beat:1,dur:0.25}, {beat:3,dur:0.25}]},
      {voice:"hihat", hits:[{beat:0,dur:0.25}, {beat:0.5,dur:0.25}, {beat:1,dur:0.25}, {beat:1.5,dur:0.25}, {beat:1.75,dur:0.25}, {beat:2,dur:0.25}, {beat:2.5,dur:0.25}, {beat:3,dur:0.25}, {beat:3.5,dur:0.25}, {beat:3.75,dur:0.25}]},
      {voice:"bass1", hits:[{beat:0,dur:1.5}, {beat:1.5,dur:1}, {beat:2.5,dur:1.5}]},
      {voice:"bass3", hits:[]}, {voice:"bass5", hits:[]}, {voice:"bass7", hits:[]}
    ]
  },
  halftime: {
    label: "Half-Time", loopBeats: 4, lanes: [
      {voice:"kick", hits:[{beat:0,dur:0.25}]},
      {voice:"snare", hits:[{beat:2,dur:0.25}]},
      {voice:"hihat", hits:[{beat:0,dur:0.25}, {beat:0.5,dur:0.25}, {beat:1,dur:0.25}, {beat:1.5,dur:0.25}, {beat:2,dur:0.25}, {beat:2.5,dur:0.25}, {beat:3,dur:0.25}, {beat:3.5,dur:0.25}]},
      {voice:"bass1", hits:[{beat:0,dur:2}, {beat:2,dur:2}]},
      {voice:"bass3", hits:[]}, {voice:"bass5", hits:[]}, {voice:"bass7", hits:[]}
    ]
  },
  latin: {
    label: "Latin", loopBeats: 4, lanes: [
      {voice:"kick", hits:[{beat:0,dur:0.25}, {beat:0.75,dur:0.25}, {beat:1.5,dur:0.25}, {beat:2.5,dur:0.25}, {beat:3.25,dur:0.25}]},
      {voice:"snare", hits:[{beat:1,dur:0.25}, {beat:3,dur:0.25}]},
      {voice:"hihat", hits:[{beat:0,dur:0.25}, {beat:0.25,dur:0.25}, {beat:0.5,dur:0.25}, {beat:0.75,dur:0.25}, {beat:1,dur:0.25}, {beat:1.25,dur:0.25}, {beat:1.5,dur:0.25}, {beat:1.75,dur:0.25}, {beat:2,dur:0.25}, {beat:2.25,dur:0.25}, {beat:2.5,dur:0.25}, {beat:2.75,dur:0.25}, {beat:3,dur:0.25}, {beat:3.25,dur:0.25}, {beat:3.5,dur:0.25}, {beat:3.75,dur:0.25}]},
      {voice:"bass1", hits:[{beat:0,dur:0.75}, {beat:0.75,dur:0.75}, {beat:1.5,dur:1}, {beat:2.5,dur:0.75}, {beat:3.25,dur:0.75}]},
      {voice:"bass3", hits:[]}, {voice:"bass5", hits:[]}, {voice:"bass7", hits:[]}
    ]
  }
};

// customBeatPatterns (state.customBeatPatterns in the app) holds only the
// beats a project has actually edited (a full pattern override each) --
// everything else falls back to the built-in default, so editing "Rock"
// here never touches other projects, and un-edited beats stay exactly as
// they always were.
function activeBeatPattern(beatKey, customBeatPatterns) {
  return (customBeatPatterns && customBeatPatterns[beatKey])
    || BUILTIN_BEAT_PATTERNS[beatKey]
    || BUILTIN_BEAT_PATTERNS.rock;
}
function beatPatternLabel(beatKey) {
  return BUILTIN_BEAT_PATTERNS[beatKey] ? BUILTIN_BEAT_PATTERNS[beatKey].label : beatKey;
}
function laneByVoice(pattern, voice) {
  return pattern.lanes.filter(function (l) { return l.voice === voice; })[0] || null;
}
function patternHasHitAtStep(lane, step, stepsPerBeat) {
  return !!lane && lane.hits.some(function (h) { return Math.round(h.beat * stepsPerBeat) === step; });
}

// The chord's own already-computed tone at a given SLOT (0=root, 1=3rd or
// sus-substitute, 2=5th or augmented, 3=7th) -- exactly the tones the chord
// itself is built from. Slot 3 clamps to slot 0 when the chord is a plain
// triad with no 7th to reference.
function chordTonePitch(chord, slot) {
  if (slot < 0) slot = 0;
  if (slot >= chord.offsets.length) slot = 0;
  return chord.chordRootPitch + chord.offsets[slot];
}

// A single octave shift for a block's bass line, anchored to the CHORD'S OWN
// ROOT and computed ONCE per block, then applied to every hit alike --
// rather than wrapping each hit into the register independently, which
// would collapse any pattern that deliberately spans more than an octave
// down to a single repeated pitch, since a note and that same note an
// octave up would both get wrapped back to the identical spot.
function bassOctaveShift(rootPitch, bassWrapLow) {
  var shift = 0;
  var wrapLow = bassWrapLow;
  while (rootPitch + shift < wrapLow) shift += 12;
  while (rootPitch + shift >= wrapLow + 12) shift -= 12;
  return shift;
}

// Single-note bass pitch for the static (non-rhythmic) hold/tap preview
// contexts -- uses whichever bass lane has the EARLIEST hit in the active
// pattern, so a preview note matches what would actually sound first at
// the start of a block.
// pattern: the beat in use, from activeBeatPattern(beatKey, customBeatPatterns).
function computeBassPitchForBlock(block, chord, pattern, bassWrapLow) {
  if (block.bassToneIndex === -1) return null;
  var best = null;
  pattern.lanes.forEach(function (lane) {
    var slot = bassSlotForVoice(lane.voice);
    if (slot < 0 || !lane.hits.length) return;
    lane.hits.forEach(function (h) {
      if (!best || h.beat < best.beat) best = {beat: h.beat, slot: slot};
    });
  });
  var slot = best ? best.slot : 0;
  var shift = bassOctaveShift(chord.chordRootPitch, bassWrapLow);
  return chordTonePitch(chord, slot) + shift;
}

// What a block shows on screen: `degree` large, the chord's job in the key written as a
// numeral plus its formula (V7, \u266DVI, ii7, V7/ii, vii\u00B07/V), and `name` small, the
// chord itself (G7, A\u266D, Dm7). A free chord has no degree in the key, so its large
// label is its root and quality (E, F\u266Fm7). Shared by the phone app and the device.
var FUNCTION_SHORT = {dominant: "V", tritoneSub: "subV", leadingTone: "vii\u00B0"};
var QUALITY_SHORT = {major: "", minor: "m", dominant: "", diminished: "\u00B0"};
function blockLabel(block, masterRootIndex, masterModeIndex) {
  var chord = buildChord(block, masterRootIndex, masterModeIndex);
  var name = getChordSymbol(chord, masterRootIndex).replace(/ \(.*\)$/, "");
  var ext = EXTENSION_NAMES[block.extensionIndex];
  var extMark = ext === "triad" ? "" : ext;
  var susMark = block.susIndex === 1 ? "sus2" : block.susIndex === 2 ? "sus4" : "";
  var fifthMark = chord.aug ? "+" : chord.flat5 ? "\u266D5" : "";
  var degree;
  if (block.chordSource === "applied") {
    var target = degreeLabels(MASTER_MODE_NAMES[masterModeIndex])[block.appliedTargetIndex] || "?";
    var fn = FUNCTION_SHORT[block.appliedFunction] || "V";
    degree = fn + (block.appliedFunction === "leadingTone" ? "7" : extMark) + susMark + fifthMark + "/" + target;
  } else if (block.chordSource === "free") {
    var root = pitchToNoteName(block.freeRoot || 0, keyPrefersFlats(masterRootIndex, masterModeIndex)).replace("#", "\u266F");
    var q = FREE_QUALITY_INTERVALS[block.freeQuality] ? block.freeQuality : "major";
    // A dominant triad sounds as a plain major triad, so it only reads "7" once a 7th is there.
    var qMark = q === "dominant" ? extMark : QUALITY_SHORT[q] + (q === "major" && extMark && extMark !== "6" ? "maj" + extMark : extMark);
    degree = root + qMark + susMark + fifthMark;
  } else {
    var mode = block.blockModeIndex ? BLOCK_MODE_NAMES[block.blockModeIndex] : MASTER_MODE_NAMES[masterModeIndex];
    var numeral = degreeLabels(mode)[block.degreeIndex];
    // A diminished degree (vii\u00B0) already has its flat five; don't say it twice.
    if (chord.flat5 && /\u00B0$/.test(numeral)) fifthMark = "";
    degree = numeral + extMark + susMark + fifthMark;
  }
  return {degree: degree, name: name};
}

export {
  // constants
  MODES, DEGREE_NAMES, DEGREE_INDEX, BLOCK_MODE_NAMES, MASTER_MODE_NAMES,
  EXTENSION_NAMES, EXTENSION_TONE_COUNT, SUS_NAMES, DROP_NAMES,
  NOTE_NAMES, NOTE_NAMES_FLAT, NOTE_NAME_TO_OFFSET,
  FLAT_PREFERRING_MAJOR_ROOT, MASTER_MODE_RELATIVE_MAJOR_OFFSET,
  DURATION_NAMES, DURATION_BEATS, DURATION_MODIFIER_NAMES,
  ROMAN_BASE, APPLIED_FUNCTIONS, APPLIED_FUNCTION_LABELS,
  DOMINANT_INTERVALS, DIMINISHED7_INTERVALS, FREE_QUALITIES, FREE_QUALITY_INTERVALS,
  CHORD_DEGREE_REFERENCE, STACKED_THIRD_ROLES,
  BASS_VOICES, BUILTIN_BEAT_PATTERNS,
  // chords
  keyPrefersFlats, buildExtendedScale, applyDrops, degreeLabels, buildChord,
  pitchToNoteName, pitchToFullNoteName, noteChoiceLabel, getChordSymbol,
  getDurationBeats, defaultBlock, chordToneLabel, chordToneRoles, appliedFunctionLabel, blockLabel,
  // bass and drums
  bassSlotForVoice, activeBeatPattern, beatPatternLabel, laneByVoice, patternHasHitAtStep,
  chordTonePitch, bassOctaveShift, computeBassPitchForBlock
};
