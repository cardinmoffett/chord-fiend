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
//   chordSource "free", with freeRoot (a step 0-11 above the key's root): a chord on
//                any root, not tied to the key's scale. It starts as a major triad with a
//                flat 7th (when the shape has one), and Alter shapes it from there.
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
// SHAPE: which of the scale's tones a chord stacks (stored as extensionIndex). "add9" and
// "6/9" are the triad, or the 6 chord, plus the scale's own 9th without a 7th. Editors
// show them in SHAPE_ORDER (Triad, add9, 6, 6/9, 7, 9, 11, 13); the list order here only
// gives each shape its stored number.
var EXTENSION_NAMES = ["triad","6","7","9","11","13","add9","6/9"];
var SHAPE_ORDER = [0, 6, 1, 7, 2, 3, 4, 5];
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

// ALTER: per-tone choices that step a chord off what its source gives. Unset means
// "what the key (or the function, or the free formula) gives".
//   third     "major" | "minor"   (sus2 / sus4 sit in the same editor row; stored as susIndex)
//   fifth     "b5" | "5" | "#5"   (aug / flat5 are the older way to set it and still work)
//   seventh   "dim" | "min" | "maj"   (bb7, b7, 7), when the shape has a 7th
//   ninth     "b9" | "9" | "#9"       when the shape has a 9th (add9, 6/9, 9, 11, 13)
//   eleventh  "11" | "#11"            on 11 and 13
//   thirteenth "b13" | "13"           on 13
var THIRDS = {major: 4, minor: 3};
var FIFTHS = {"b5": 6, "5": 7, "#5": 8};
var SEVENTHS = {maj: 11, min: 10, dim: 9};
var NINTHS = {"b9": 13, "9": 14, "#9": 15};
var ELEVENTHS = {"11": 17, "#11": 18};
var THIRTEENTHS = {"b13": 20, "13": 21};
var BB = "\u266D\u266D"; // a double flat, as labels print it
var ALTER_FIELDS = ["third", "fifth", "seventh", "ninth", "eleventh", "thirteenth"];
// The value each Alter field reads from a chord's actual offsets.
function valueOf(table, offset) {
  for (var k in table) if (table[k] === offset) return k;
  return null;
}
// "G9" with a flat 9 reads G7(b9): the chord's number is its highest stacked tone that
// isn't altered, and each altered tone follows in brackets: G13(b9), G9(#11,b13).
function alteredExtensionName(name, toneCount, tensions) {
  var tops = {5: 9, 6: 11, 7: 13};
  var top = tops[toneCount];
  if (top) {
    var altered = tensions.map(function (t) { return Number(t.replace(/[^0-9]/g, "")); });
    var n = top;
    while (n > 7 && altered.indexOf(n) >= 0) n -= 2;
    // (a minor chord's "m(maj9)" keeps its bracket: "m(maj7)(b9)"; a chosen bb7 stays in
    // front of the list: "9(bb7)" with a flat 9 reads "(bb7,b9)")
    if (n !== top) name = name.replace(new RegExp(top + "(\\)?)(\\((?:bb|" + BB + ")7\\))?$"), n + "$1$2");
  }
  return (name + "(" + tensions.join(",") + ")")
    .replace(new RegExp("((?:bb|" + BB + ")7)\\)\\("), "$1,")
    .replace(new RegExp("7\\(((?:bb|" + BB + ")7)"), "($1");
}

function buildChord(block, masterRootIndex, masterModeIndex) {
  var blockModeName = BLOCK_MODE_NAMES[block.blockModeIndex];
  var isThru = blockModeName === "Thru";
  var resolvedMode = isThru ? MASTER_MODE_NAMES[masterModeIndex] : blockModeName;
  var modeIntervals = MODES[resolvedMode];

  var extensionName = EXTENSION_NAMES[block.extensionIndex];
  var addNine = extensionName === "add9" || extensionName === "6/9";
  var is6 = extensionName === "6" || extensionName === "6/9";
  var toneCount = is6 || addNine ? 3 : EXTENSION_TONE_COUNT[extensionName];
  var susName = SUS_NAMES[block.susIndex];

  var isApplied = block.chordSource === "applied";
  var isFree = block.chordSource === "free";
  var fn = isApplied ? (block.appliedFunction || "dominant") : null;
  var dim7Fn = fn === "leadingTone" || fn === "commonTone"; // a fixed dim7, whatever Shape says
  var degreeIndex, chordRootOffset, offsets;
  var tensions = []; // extension tones the block altered off the natural 9, 11, 13
  var effectiveSus = susName, effectiveAug = !!block.aug, effectiveIs6 = is6;
  var effectiveFlat5 = !block.aug && !!block.flat5;

  if (isFree) {
    // FREE: a root anywhere, measured up from the key's root so the octave
    // setting means the same as for every other block. Its formula is the plain
    // dominant stack (major triad, flat 7th, natural 9, 11, 13); Alter shapes it.
    var qualityIntervals = DOMINANT_INTERVALS;
    degreeIndex = -1; // not a degree of the key
    // freeRoot is a step above the key's root (0-11), so a free chord keeps its number
    // (III, \u266DVI) and moves with the key like every other block.
    chordRootOffset = (((block.freeRoot || 0) % 12) + 12) % 12;
    offsets = is6 ? qualityIntervals.slice(0, 3).concat([9]) : qualityIntervals.slice(0, toneCount);
    if (susName === "sus2") offsets[1] = 2;
    else if (susName === "sus4") offsets[1] = 5;
    if (addNine) offsets.push(qualityIntervals[4]);
  } else if (isApplied) {
    // The target's OWN diatonic root -- same scale-walk the plain diatonic
    // path below uses, just to locate where the target sits, not to shape
    // the applied chord's own quality (that's fixed by the function).
    var targetIndex = block.appliedTargetIndex || 0;
    var targetExtended = buildExtendedScale(modeIntervals, targetIndex + 8);
    var targetRootOffset = targetExtended[targetIndex];
    degreeIndex = targetIndex; // reused below for pitch base + display

    if (fn === "mediant") {
      // A chromatic mediant isn't aimed at a target: its root is a step from the key's
      // root (\u266DIII, III, \u266DVI, VI), major or minor, for color rather than resolution.
      var med = MEDIANTS[Math.min(targetIndex, MEDIANTS.length - 1)];
      var medIntervals = med.minor ? MINOR7_INTERVALS : MAJOR7_INTERVALS;
      chordRootOffset = med.step;
      degreeIndex = med.near[med.near.length - 1];
      offsets = is6 ? medIntervals.slice(0, 3).concat([9]) : medIntervals.slice(0, toneCount);
      if (susName === "sus2") offsets[1] = 2;
      else if (susName === "sus4") offsets[1] = 5;
      if (addNine) offsets.push(14);
    } else if (dim7Fn) {
      // Leading tone: a half-step below the target. Common-tone: on the target's own root,
      // so it shares that note with the chord it decorates (C\u00B07 \u2192 C).
      chordRootOffset = targetRootOffset - (fn === "leadingTone" ? 1 : 0);
      offsets = DIMINISHED7_INTERVALS.slice(); // a fully diminished 7th; Shape doesn't apply
      effectiveAug = false; effectiveIs6 = false;
      effectiveFlat5 = false; // already has one
      addNine = false;
      // Alter still works on it, like any chord (a vii\u00F87/V with a \u266D7, a sus4).
      if (susName === "sus2") offsets[1] = 2;
      else if (susName === "sus4") offsets[1] = 5;
    } else {
      // Dominant: a 5th above the target. Tritone sub: a half-step above. Backdoor: a whole
      // step below (\u266DVII7). All dominant 7ths. Applied ii: a whole step above, minor 7th.
      chordRootOffset = targetRootOffset + ({tritoneSub: 1, backdoor: 10, supertonic: 2}[fn] || 7);
      var stack = fn === "supertonic" ? MINOR7_INTERVALS : DOMINANT_INTERVALS;
      offsets = is6 ? stack.slice(0, 3).concat([9]) : stack.slice(0, toneCount); // a 6 chord: triad + a major 6th
      if (susName === "sus2") offsets[1] = 2; // fixed major 2nd
      else if (susName === "sus4") offsets[1] = 5; // fixed perfect 4th
      if (addNine) offsets.push(14);
    }
  } else {
    var degree = DEGREE_NAMES[block.degreeIndex];
    degreeIndex = DEGREE_INDEX[degree];
    var extended = buildExtendedScale(modeIntervals, degreeIndex + Math.max(toneCount,4)*2 + 7);
    chordRootOffset = extended[degreeIndex];
    offsets = [];
    for (var k = 0; k < toneCount; k++) offsets.push(extended[degreeIndex + k*2] - chordRootOffset);
    // sus2, sus4, 6 and add9 name exact intervals -- a whole step, a perfect 4th, a major
    // 6th, a major 9th -- so they're fixed, not read from the mode: Phrygian's half-step
    // 2nd or Lydian's raised 4th would make a "sus2" or "sus4" that isn't one. (Alter can
    // still change the added 9th.) The stacked 9th, 11th and 13th do come from the mode,
    // and the chord's name says so when they aren't natural (iii9 in C reads iii7(b9)).
    if (susName === "sus2") offsets[1] = 2;
    else if (susName === "sus4") offsets[1] = 5;

    if (is6) offsets.push(9);
    if (addNine) offsets.push(14);
  }

  // ALTER: every chord, applied ones included, can step off what its source gives, one
  // tone at a time. Each starts at "what the source gives" (unset), and the block's
  // label shows any change, so the chord keeps its number (ii with a major 3rd and a
  // flat 7th reads II7; V7/ii with a minor 3rd reads v7/ii).
  effectiveSus = SUS_NAMES[block.susIndex] || "none";
  var hasSeventh = !effectiveIs6 && !addNine && offsets.length >= 4;
  var ninthSlot = addNine ? offsets.length - 1 : (!effectiveIs6 && offsets.length >= 5 ? 4 : -1);
  var eleventhSlot = !effectiveIs6 && !addNine && offsets.length >= 6 ? 5 : -1;
  var thirteenthSlot = !effectiveIs6 && !addNine && offsets.length >= 7 ? 6 : -1;
  {
    if (effectiveSus === "none" && THIRDS[block.third] !== undefined) offsets[1] = THIRDS[block.third];
    if (FIFTHS[block.fifth] !== undefined) {
      // An explicit 5th (\u266D5, 5 or \u266F5) -- the only way to give vii\u00B0 a perfect 5th.
      offsets[2] = FIFTHS[block.fifth];
      effectiveAug = offsets[2] === 8;
      effectiveFlat5 = offsets[2] === 6;
    } else if (!(isApplied && (is6 || dim7Fn))) { // (the older aug isn't used on an applied 6 chord or the leading-tone chord, as in the original app)
      if (block.aug) offsets[2] = 8;
      else if (effectiveFlat5) offsets[2] = 6;
    }
    if (hasSeventh && SEVENTHS[block.seventh] !== undefined) offsets[3] = SEVENTHS[block.seventh];
    // sus2 is already the 9th's note and sus4 the 11th's, so those rows step aside.
    if (ninthSlot >= 0 && effectiveSus !== "sus2" && NINTHS[block.ninth] !== undefined) {
      offsets[ninthSlot] = NINTHS[block.ninth];
    }
    if (eleventhSlot >= 0 && effectiveSus !== "sus4" && ELEVENTHS[block.eleventh] !== undefined) {
      offsets[eleventhSlot] = ELEVENTHS[block.eleventh];
    }
    if (thirteenthSlot >= 0 && THIRTEENTHS[block.thirteenth] !== undefined) {
      offsets[thirteenthSlot] = THIRTEENTHS[block.thirteenth];
    }
  }
  // Every extension that isn't natural is named, whether Alter or the mode put it there:
  // iii9 in C has an F, a flat 9, so it reads iii7(b9) / Em7(b9), not Em9. (A sus2 is
  // already the 9th's note and a sus4 the 11th's, so those aren't counted twice.)
  [[ninthSlot, 9, effectiveSus !== "sus2"], [eleventhSlot, 11, effectiveSus !== "sus4"], [thirteenthSlot, 13, true]].forEach(function (x) {
    if (x[0] < 0 || !x[2] || offsets[x[0]] === CHORD_DEGREE_REFERENCE[x[1]]) return;
    tensions.push(chordToneLabel(offsets[x[0]], x[1]).replace(/\u266D/g, "b").replace(/\u266F/g, "#"));
  });
  // What each Alter row reads on this chord (null where the chord has no such tone).
  var alter = {
    third: effectiveSus !== "none" ? effectiveSus : valueOf(THIRDS, offsets[1]),
    fifth: valueOf(FIFTHS, offsets[2]),
    seventh: hasSeventh ? valueOf(SEVENTHS, offsets[3]) : null,
    ninth: ninthSlot >= 0 ? valueOf(NINTHS, offsets[ninthSlot]) : null,
    eleventh: eleventhSlot >= 0 ? valueOf(ELEVENTHS, offsets[eleventhSlot]) : null,
    thirteenth: thirteenthSlot >= 0 ? valueOf(THIRTEENTHS, offsets[thirteenthSlot]) : null
  };

  var base = 60 + NOTE_NAME_TO_OFFSET[NOTE_NAMES[masterRootIndex]] + block.octave*12;
  var chordRootPitch = base + chordRootOffset;
  // Each tone keeps its label through the sort, so toneLabels[i] always
  // names exactly the note that is i-th from the bottom in root position --
  // which is also exactly what inversion i puts in the bass.
  var roles = chordToneRoles(offsets.length - (addNine ? 1 : 0), effectiveSus, effectiveIs6).concat(addNine ? [9] : []);
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
          isFree:isFree, flat5:effectiveFlat5 && offsets[2] === 6,
          addNine: addNine,
          tensions: tensions, alter: alter,
          // The bass lanes ("1 3 5 7") by role: an added 9th never plays as the "7".
          bassOffsets: addNine ? [0, offsets[1], offsets[2], effectiveIs6 ? offsets[3] : 0] : null};
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
  var preferFlats = chord.isApplied && (chord.appliedFunction === "tritoneSub" || chord.appliedFunction === "backdoor")
    ? true
    : keyPrefersFlats(masterRootIndex, MASTER_MODE_NAMES.indexOf(chord.resolvedMode));
  // A free chord (or a mediant) is spelled the way its step is numbered: \u266DIII is E\u266D, \u266FIV is F\u266F.
  if (chord.isFree || (chord.isApplied && chord.appliedFunction === "mediant")) {
    var stepAcc = stepNumeral(chord.chordRootPitch - masterRootIndex, isDiminishedTriad(chord)).charAt(0);
    if (stepAcc === "\u266D") preferFlats = true;
    else if (stepAcc === "\u266F") preferFlats = false;
  }
  var rootName = pitchToNoteName(chord.chordRootPitch, preferFlats);
  var tensions = chord.tensions || [];
  if (chord.addNine || tensions.length) {
    // Name the chord without its added 9th and its altered extensions, then say what
    // was added or altered: Cadd9, Am6/9, Cadd(b9), G7(b9), G9(#11), G13(b9,#11).
    var offs = chord.offsets.slice();
    var natural = {5: 14, 6: 17, 7: 21};
    if (!chord.addNine) for (var slot = 4; slot < offs.length; slot++) offs[slot] = natural[slot + 1];
    if (chord.addNine) offs.pop();
    var n = getChordSymbol(Object.assign({}, chord, {offsets: offs, addNine: false, tensions: [], dropIndex: 0}), masterRootIndex);
    if (chord.addNine) {
      var nine = tensions[0] || "9";
      n = chord.is6 ? n.replace(/6$/, "6/" + nine) : (nine === "9" ? n + "add9" : n + "(add" + nine + ")");
    } else if (tensions.length) n = alteredExtensionName(n, offs.length, tensions);
    return chord.dropIndex > 0 ? n + " (" + DROP_NAMES[chord.dropIndex] + ")" : n;
  }
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
      // A double-flat 7th chosen on anything but a diminished triad is named as such: C(bb7), Dm9(bb7).
      else if (seventh===9 && q!=="?") base = rootName+{maj:"",min:"m",aug:third===3?"m#5":"aug",b5:"(b5)"}[q]+(d2==="7"?"":d2)+"(bb7)";
      else if (q==="dim" && seventh===10) base = rootName+"m"+d2+"b5";
      else if (q==="aug" && seventh===11) base = rootName+"maj"+d2+"#5";
      else if (q==="aug" && seventh===10) base = rootName+(third===3?"m":"")+d2+"#5"; // G7#5, Dm7#5 (the original app had no name for these and showed "G?7")
      else if (q==="b5" && seventh===10) base = rootName+d2+"b5";
      else if (q==="b5" && seventh===11) base = rootName+"maj"+d2+"b5";
      else base = rootName+"?"+d2;
    }
  }
  if (chord.dropIndex > 0) base += " (" + DROP_NAMES[chord.dropIndex] + ")";
  return base;
}

function getDurationBeats(block) {
  var base = DURATION_BEATS[DURATION_NAMES[block.durationIndex]] * (block.durationMult || 1);
  if (block.durationModifier === 1) return base * 1.5;
  if (block.durationModifier === 2) return base * (2/3);
  return base;
}

// LENGTH as editors show it: a base note (quarter, half, whole, double whole -- the
// lengths chords take) and one modifier: a feel (straight, dotted, triplet) or a multiplier (x2, x3, x4
// tie copies together; x1/2, x1/4 split it). Stored as durationIndex (the base),
// durationModifier (the feel) and durationMult (an engine addition; missing means 1).
var LENGTH_BASES = ["quarter", "half", "whole", "double"];
var LENGTH_BASE_INDEX = {quarter: 4, half: 3, whole: 2, double: 1};
var LENGTH_MODS = ["straight", "dotted", "triplet", "x2", "x3", "x4", "x1/2", "x1/4"];
var LENGTH_MOD_LABELS = {straight: "Straight", dotted: "Dotted", triplet: "Triplet", x2: "\u00D72", x3: "\u00D73", x4: "\u00D74", "x1/2": "\u00D7\u00BD", "x1/4": "\u00D7\u00BC"};
var LENGTH_MULTS = {x2: 2, x3: 3, x4: 4, "x1/2": 0.5, "x1/4": 0.25};
function lengthParts(block) {
  var idx = block.durationIndex, mult = block.durationMult || 1;
  // The other stored lengths fold into a base and a multiplier: 4 bars is a double x2.
  var fold = {0: [1, 2], 5: [4, 0.5], 6: [4, 0.25]}[idx];
  if (fold) { idx = fold[0]; mult *= fold[1]; }
  var base = {1: "double", 2: "whole", 3: "half", 4: "quarter"}[idx] || "whole";
  var mod = "straight";
  if (block.durationModifier === 1) mod = "dotted";
  else if (block.durationModifier === 2) mod = "triplet";
  else for (var k in LENGTH_MULTS) if (LENGTH_MULTS[k] === mult) mod = k;
  return {base: base, mod: mod};
}
function lengthChange(base, mod) {
  return {durationIndex: LENGTH_BASE_INDEX[base], durationModifier: mod === "dotted" ? 1 : mod === "triplet" ? 2 : 0, durationMult: LENGTH_MULTS[mod] || 1};
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
//   - Applied ii of <target>: the minor 7th a whole step above the target -- the
//     first half of a ii-V into it.
//   - Backdoor to <target>: the dominant 7th a whole step BELOW the target (\u266DVII7).
//   - Common-tone dim into <target>: a diminished 7th on the target's own root, so the
//     two share that note.
//   - Mediant: not aimed at a target. appliedTargetIndex picks one of MEDIANTS, a major
//     or minor chord a 3rd from the key's root, used for color.
var APPLIED_FUNCTIONS = ["dominant", "supertonic", "tritoneSub", "backdoor", "leadingTone", "commonTone", "mediant"];
var APPLIED_FUNCTION_LABELS = {dominant: "Dominant of", supertonic: "ii of", tritoneSub: "Tritone sub of", backdoor: "Backdoor to",
  leadingTone: "Leading-tone into", commonTone: "Common-tone dim into", mediant: "Mediant"};
// The chromatic mediants: a step above the key's root, major or minor, and the degree(s)
// it sits next to (the color it takes).
var MEDIANTS = [{step: 3, minor: false, near: [1, 2]}, {step: 4, minor: false, near: [2]}, {step: 8, minor: false, near: [4, 5]},
  {step: 9, minor: false, near: [5]}, {step: 3, minor: true, near: [1, 2]}, {step: 8, minor: true, near: [4, 5]}];
var DOMINANT_INTERVALS = [0, 4, 7, 10, 14, 17, 21]; // root, 3rd, 5th, b7, 9th, 11th, 13th
var MAJOR7_INTERVALS = [0, 4, 7, 11, 14, 17, 21];
var MINOR7_INTERVALS = [0, 3, 7, 10, 14, 17, 21];
var DIMINISHED7_INTERVALS = [0, 3, 6, 9]; // root, m3, dim5, dim7 -- always this exact tetrad

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

function mediantNumeral(block) {
  var med = MEDIANTS[Math.min(block.appliedTargetIndex || 0, MEDIANTS.length - 1)];
  var n = stepNumeral(med.step);
  return med.minor ? n.toLowerCase() : n;
}
// The degrees whose color an applied chord takes: its target, or for a mediant the
// degree(s) it sits beside (the app blends two hues).
function appliedColorDegrees(block) {
  if (block.appliedFunction === "mediant") return MEDIANTS[Math.min(block.appliedTargetIndex || 0, MEDIANTS.length - 1)].near;
  return [block.appliedTargetIndex || 0];
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
  if (block.appliedFunction === "mediant") return "Mediant " + mediantNumeral(block);
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
  // add9 and 6/9 map the lanes by role (bassOffsets); others use tone order.
  var offs = chord.bassOffsets || chord.offsets;
  if (slot >= offs.length) slot = 0;
  return chord.chordRootPitch + offs[slot];
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
// The extension part of a label with altered extensions: "9" with a flat 9 reads
// "7(\u266D9)", "13" with a flat 9 and a sharp 11 reads "13(\u266D9,\u266F11)".
function tensionLabel(chord, extPart) {
  var tensions = chord.tensions || [];
  if (!tensions.length) return extPart;
  var pretty = tensions.map(prettyAccidentals);
  if (extPart === "add9") return "add" + pretty[0];
  if (extPart === "6/9") return "6/" + pretty[0];
  var m = extPart.match(new RegExp("(9|11|13)\\)?(\\(" + BB + "7\\))?$"));
  if (!m) return extPart + "(" + pretty.join(",") + ")";
  return alteredExtensionName(extPart, {"9": 5, "11": 6, "13": 7}[m[1]], pretty);
}
function prettyAccidentals(sym) { return sym.replace(/b(?=\d)/g, "\u266D").replace(/#/g, "\u266F"); }

// The same block with every Alter choice cleared: "what the key gives". Editors compare
// against it to show the chord's real tones and to know when a choice is a change (a
// tap on the key's own value clears the change). Sus is part of the 3rd row, so it goes too.
function withoutAlter(block) {
  var b = Object.assign({}, block);
  ALTER_FIELDS.forEach(function (f) { delete b[f]; });
  delete b.tension;
  b.aug = 0; b.flat5 = 0; b.susIndex = 0;
  return b;
}

// The Alter rows an editor shows for a block, each with its choices (value, label).
// Only tones the chord has get a row; an applied chord keeps its function's 3rd (sus
// only) and 7th; the leading-tone dim7 gets none; sus2 hides the 9th and sus4 the 11th.
var ALTER_ROW_SPECS = {
  third: {label: "3rd", choices: [["sus2", "sus2"], ["minor", "\u266D3"], ["major", "3"], ["sus4", "sus4"]]},
  fifth: {label: "5th", choices: [["b5", "\u266D5"], ["5", "5"], ["#5", "\u266F5"]]},
  seventh: {label: "7th", choices: [["dim", "\u266D\u266D7"], ["min", "\u266D7"], ["maj", "7"]]},
  ninth: {label: "9th", choices: [["b9", "\u266D9"], ["9", "9"], ["#9", "\u266F9"]]},
  eleventh: {label: "11th", choices: [["11", "11"], ["#11", "\u266F11"]]},
  thirteenth: {label: "13th", choices: [["b13", "\u266D13"], ["13", "13"]]}
};
function alterRows(block, masterRootIndex, masterModeIndex) {
  // Every row is always returned, in the same order, so editors keep a fixed layout; a
  // row for a tone the chord doesn't have (or one a sus already covers) is `disabled`.
  var chord = buildChord(block, masterRootIndex, masterModeIndex);
  var keyChord = buildChord(withoutAlter(block), masterRootIndex, masterModeIndex);
  return ALTER_FIELDS.map(function (f) {
    var spec = ALTER_ROW_SPECS[f];
    var disabled = chord.alter[f] === null ||
      (f === "ninth" && chord.sus === "sus2") || (f === "eleventh" && chord.sus === "sus4");
    return {field: f, label: spec.label, value: disabled ? null : chord.alter[f], keyValue: keyChord.alter[f], disabled: disabled,
            choices: spec.choices.map(function (c) { return {value: c[0], label: c[1]}; })};
  });
}
// The block change for picking `value` in an Alter row: the key's own value clears the
// field. Fields that end up unset are returned as undefined (callers delete them).
function alterChange(block, field, value, masterRootIndex, masterModeIndex) {
  var keyChord = buildChord(withoutAlter(block), masterRootIndex, masterModeIndex);
  var isKey = value === keyChord.alter[field];
  var change = {};
  if (field === "third") {
    change.susIndex = value === "sus2" ? 1 : value === "sus4" ? 2 : 0;
    change.third = change.susIndex || isKey ? undefined : value;
    if (value === "sus2") change.ninth = undefined;
    if (value === "sus4") change.eleventh = undefined;
  } else {
    change[field] = isKey ? undefined : value;
    if (field === "fifth") { change.aug = 0; change.flat5 = 0; }
  }
  return change;
}
// What a block keeps when its root or kind changes (category, degree, mode, function,
// target, free root): nothing from Alter. And after a shape change: only the
// alterations for tones the new shape still has.
function alterFitToShape(block) {
  var b = Object.assign({}, block);
  var ext = EXTENSION_NAMES[b.extensionIndex];
  var hasSeventh = ext === "7" || ext === "9" || ext === "11" || ext === "13";
  var hasNinth = ext === "9" || ext === "11" || ext === "13" || ext === "add9" || ext === "6/9";
  if (!hasSeventh) delete b.seventh;
  if (!hasNinth) delete b.ninth;
  if (ext !== "11" && ext !== "13") delete b.eleventh;
  if (ext !== "13") delete b.thirteenth;
  return b;
}

// POSITION: inversion and octave as one control that rotates the chord a note at a time.
// Up moves the lowest note to the top (the next inversion; past the last one, root
// position an octave up); down moves the top note to the bottom. So voice leading's usual
// "inversion up, octave down" is a tap or two, never a jump. Returns the block's new
// {inversion, octave}, or null at the octave limit (-3..+3).
var POSITION_OCTAVES = [-3, 3];
function positionStep(block, chord, dir) {
  var n = chord.toneLabels.length;
  var inv = chord.inversion, oct = block.octave || 0;
  inv += dir;
  if (inv >= n) { inv = 0; oct += 1; }
  if (inv < 0) { inv = n - 1; oct -= 1; }
  if (oct < POSITION_OCTAVES[0] || oct > POSITION_OCTAVES[1]) return null;
  return {inversion: inv, octave: oct};
}
// What the Inversion control shows: the tone in the bass, and an arrow per octave the
// chord has moved ("3", "\u266D7 \u2191", "5 \u2193\u2193").
function positionLabel(block, chord) {
  var oct = block.octave || 0, arrows = "";
  for (var i = 0; i < Math.abs(oct); i++) arrows += oct > 0 ? "\u2191" : "\u2193";
  return chord.toneLabels[chord.inversion] + (arrows ? " " + arrows : "");
}

// The numeral for a chromatic step above the key's root (a free chord's root), spelled
// against the major scale: I, \u266DII, II, \u266DIII, III, IV, \u266FIV, V, \u266DVI, VI, \u266DVII, VII.
var STEP_NUMERALS = [["", 0], ["\u266D", 1], ["", 1], ["\u266D", 2], ["", 2], ["", 3], ["\u266F", 3], ["", 4], ["\u266D", 5], ["", 5], ["\u266D", 6], ["", 6]];
// A diminished chord on a chromatic step is a leading-tone chord into the step above, so
// it's numbered and spelled with a sharp (\u266Fi\u00B07 = C\u266Fdim7 in C, \u266Fiv\u00B07), not a flat.
var SHARP_STEP_NUMERALS = {1: ["\u266F", 0], 3: ["\u266F", 1], 6: ["\u266F", 3], 8: ["\u266F", 4], 10: ["\u266F", 5]};
function stepNumeral(step, sharpen) {
  step = ((step % 12) + 12) % 12;
  var n = (sharpen && SHARP_STEP_NUMERALS[step]) || STEP_NUMERALS[step];
  return n[0] + ROMAN_BASE[n[1]];
}
function isDiminishedTriad(chord) { return chord.sus === "none" && chord.offsets[1] === 3 && chord.offsets[2] === 6; }

// What follows a numeral, read from the chord's actual notes: the numeral's case says
// major or minor (so it is decided here too), then \u00B0 / + / \u00F8, the 7th's kind (maj7, 7,
// (maj7), \u00B07), the shape (6, 6/9, add9, 9, 11, 13), a tension, sus, and a \u266D5 / \u266F5 that
// the triad sign doesn't already say.
function numeralSuffix(chord, ext) {
  var o = chord.offsets, third = o[1], fifth = o[2];
  var sus = chord.sus !== "none";
  var lower = !sus && third === 3;
  var triad = "";
  if (!sus && third === 3 && fifth === 6) triad = "\u00B0";
  else if (!sus && third === 4 && fifth === 8) triad = "+";
  var fifthMark = "";
  if (!triad && fifth === 6) fifthMark = "\u266D5";
  else if (!triad && fifth === 8) fifthMark = "\u266F5";
  var extPart = "";
  if (ext === "6" || ext === "6/9" || ext === "add9") extPart = ext;
  else if (ext === "7" || ext === "9" || ext === "11" || ext === "13") {
    var seventh = o[3];
    if (triad === "\u00B0" && seventh === 10) { triad = "\u00F8"; extPart = ext; }
    else if (seventh === 11) extPart = lower ? "(maj" + ext + ")" : "maj" + ext;
    // a double-flat 7th is only "\u00B07" on a diminished triad; elsewhere it's spelled out
    else if (seventh === 9 && triad !== "\u00B0") extPart = (ext === "7" ? "" : ext) + "(" + BB + "7)";
    else extPart = ext;
  }
  extPart = tensionLabel(chord, extPart);
  var susMark = chord.sus === "sus2" || chord.sus === "sus4" ? chord.sus : "";
  return {lower: lower, text: triad + extPart + susMark + fifthMark};
}
function caseNumeral(numeral, lower) { return lower ? numeral.replace(/[IV]+/, function (r) { return r.toLowerCase(); }) : numeral; }

// What a block shows: `degree` large -- always a number in the key (V7, \u266DVI, II7, V7/ii,
// a free chord's step like III or \u266DVI) -- and `name` small (G7, A\u266D). Shared by the
// phone app and the device.
function blockLabel(block, masterRootIndex, masterModeIndex) {
  var chord = buildChord(block, masterRootIndex, masterModeIndex);
  var name = getChordSymbol(chord, masterRootIndex).replace(/ \(.*\)$/, "");
  var ext = EXTENSION_NAMES[block.extensionIndex];
  var degree;
  if (block.chordSource === "applied") {
    var target = degreeLabels(MASTER_MODE_NAMES[masterModeIndex])[block.appliedTargetIndex] || "?";
    var fn = block.appliedFunction;
    var dim7 = fn === "leadingTone" || fn === "commonTone";
    var sfx = numeralSuffix(chord, dim7 ? "7" : ext);
    if (fn === "mediant") {
      degree = caseNumeral(stepNumeral(MEDIANTS[Math.min(block.appliedTargetIndex || 0, MEDIANTS.length - 1)].step), sfx.lower) + sfx.text;
    } else {
      var fnBase = {dominant: "V", supertonic: "II", tritoneSub: "subV", backdoor: "\u266DVII", leadingTone: "VII", commonTone: "ct"}[fn] || "V";
      degree = caseNumeral(fnBase, sfx.lower) + sfx.text + "/" + target;
    }
  } else if (block.chordSource === "free") {
    var fs = numeralSuffix(chord, ext);
    degree = caseNumeral(stepNumeral(block.freeRoot || 0, isDiminishedTriad(chord)), fs.lower) + fs.text;
  } else {
    var mode = block.blockModeIndex ? BLOCK_MODE_NAMES[block.blockModeIndex] : MASTER_MODE_NAMES[masterModeIndex];
    var accidental = (degreeLabels(mode)[block.degreeIndex].match(/^[\u266D\u266F]*/) || [""])[0];
    var ds = numeralSuffix(chord, ext);
    degree = accidental + caseNumeral(ROMAN_BASE[block.degreeIndex], ds.lower) + ds.text;
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
  ROMAN_BASE, APPLIED_FUNCTIONS, APPLIED_FUNCTION_LABELS, MEDIANTS,
  DOMINANT_INTERVALS, MAJOR7_INTERVALS, MINOR7_INTERVALS, DIMINISHED7_INTERVALS,
  CHORD_DEGREE_REFERENCE, STACKED_THIRD_ROLES,
  BASS_VOICES, BUILTIN_BEAT_PATTERNS,
  // chords
  keyPrefersFlats, buildExtendedScale, applyDrops, degreeLabels, buildChord,
  pitchToNoteName, pitchToFullNoteName, noteChoiceLabel, getChordSymbol,
  getDurationBeats, defaultBlock, chordToneLabel, chordToneRoles, appliedFunctionLabel, appliedColorDegrees, mediantNumeral, blockLabel,
  SHAPE_ORDER, ALTER_FIELDS, positionStep, positionLabel, stepNumeral,
  LENGTH_BASES, LENGTH_MODS, LENGTH_MOD_LABELS, lengthParts, lengthChange, withoutAlter, alterRows, alterChange, alterFitToShape,
  // bass and drums
  bassSlotForVoice, activeBeatPattern, beatPatternLabel, laneByVoice, patternHasHitAtStep,
  chordTonePitch, bassOctaveShift, computeBassPitchForBlock
};
