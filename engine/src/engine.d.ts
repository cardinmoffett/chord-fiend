// Types for engine.js, for TypeScript callers such as the device. engine.js stays plain JavaScript.

export interface Block {
  /** Alter: a major or minor 3rd (sus2 / sus4 are susIndex). Unset = what the key gives. Ignored on applied chords. */
  third?: "major" | "minor";
  /** Alter: set the 5th to b5, 5 or #5 (takes precedence over aug / flat5). */
  fifth?: "b5" | "5" | "#5";
  /** Alter: a major, flat or double-flat (dim) 7th, when the shape has one. Ignored on applied chords. */
  seventh?: "maj" | "min" | "dim";
  /** Alter: the 9th, when the shape has one (add9, 6/9, 9, 11, 13). */
  ninth?: "b9" | "9" | "#9";
  /** Alter: the 11th, on 11 and 13. */
  eleventh?: "11" | "#11";
  /** Alter: the 13th, on 13. */
  thirteenth?: "b13" | "13";
  degreeIndex: number;
  blockModeIndex: number;
  extensionIndex: number;
  susIndex: number;
  aug: number | boolean;
  inversion: number;
  octave: number;
  dropIndex: number;
  durationIndex: number;
  durationModifier: number;
  /** -1 = bass off for this block, 0+ = on. */
  bassToneIndex: number;
  chordSource: "diatonic" | "applied" | "free";
  appliedTargetIndex: number;
  appliedFunction: "dominant" | "tritoneSub" | "leadingTone";
  /** Lowers the 5th a semitone. An engine addition; missing means off. */
  flat5?: number | boolean;
  /** Free mode's root, as a step above the key's root (0-11), so it reads as a numeral (III, ♭VI). */
  freeRoot?: number;
}

export type AlterField = "third" | "fifth" | "seventh" | "ninth" | "eleventh" | "thirteenth";
export interface AlterRow {
  field: AlterField;
  label: string;
  /** The chord's current value, and the value with no alteration (the key's). */
  value: string | null;
  keyValue: string | null;
  choices: { value: string; label: string }[];
}

export interface Chord {
  pitches: number[];
  chordRootPitch: number;
  offsets: number[];
  toneLabels: string[];
  inversion: number;
  sus: string;
  aug: boolean;
  is6: boolean;
  dropIndex: number;
  resolvedMode: string;
  isThru: boolean;
  chordDegreeIndex: number;
  blockOctave: number;
  isApplied: boolean;
  appliedFunction: string | null;
  isFree: boolean;
  flat5: boolean;
  addNine: boolean;
  /** Extension tones the block altered off the natural 9, 11, 13 ("b9", "#11"...). */
  tensions: string[];
  /** What each Alter row reads on this chord (null where the chord has no such tone). */
  alter: Record<AlterField, string | null>;
}

export interface BeatHit { beat: number; dur: number }
export interface BeatLane { voice: string; hits: BeatHit[] }
export interface BeatPattern { label: string; loopBeats: number; lanes: BeatLane[] }

export const MODES: Record<string, number[]>;
export const DEGREE_NAMES: string[];
export const DEGREE_INDEX: Record<string, number>;
export const BLOCK_MODE_NAMES: string[];
export const MASTER_MODE_NAMES: string[];
export const EXTENSION_NAMES: string[];
export const EXTENSION_TONE_COUNT: Record<string, number>;
export const SUS_NAMES: string[];
export const DROP_NAMES: string[];
export const NOTE_NAMES: string[];
export const NOTE_NAMES_FLAT: string[];
export const NOTE_NAME_TO_OFFSET: Record<string, number>;
export const FLAT_PREFERRING_MAJOR_ROOT: boolean[];
export const MASTER_MODE_RELATIVE_MAJOR_OFFSET: number[];
export const DURATION_NAMES: string[];
export const DURATION_BEATS: Record<string, number>;
export const DURATION_MODIFIER_NAMES: string[];
export const ROMAN_BASE: string[];
export const APPLIED_FUNCTIONS: string[];
export const APPLIED_FUNCTION_LABELS: Record<string, string>;
export const DOMINANT_INTERVALS: number[];
export const DIMINISHED7_INTERVALS: number[];
export const CHORD_DEGREE_REFERENCE: Record<number, number>;
export const STACKED_THIRD_ROLES: number[];
export const BASS_VOICES: string[];
export const BUILTIN_BEAT_PATTERNS: Record<string, BeatPattern>;

export function keyPrefersFlats(rootIndex: number, modeIndex: number): boolean;
export function buildExtendedScale(modeIntervals: number[], length: number): number[];
export function applyDrops(pitches: number[], dropIndex: number): number[];
export function degreeLabels(modeName: string): string[];
export function buildChord(block: Block, masterRootIndex: number, masterModeIndex: number): Chord;
export function pitchToNoteName(pitch: number, preferFlats?: boolean): string;
export function pitchToFullNoteName(pitch: number): string;
export function noteChoiceLabel(pitchClass: number, octave?: number): string;
export function getChordSymbol(chord: Chord, masterRootIndex: number): string;
export function getDurationBeats(block: Block): number;
export function defaultBlock(): Block;
export function chordToneLabel(offset: number, role: number): string;
export function chordToneRoles(toneCount: number, sus: string, is6: boolean): number[];
export function appliedFunctionLabel(block: Block, masterModeIndex: number): string;
export function bassSlotForVoice(voice: string): number;
export function activeBeatPattern(beatKey: string, customBeatPatterns?: Record<string, BeatPattern> | null): BeatPattern;
export function beatPatternLabel(beatKey: string): string;
export function laneByVoice(pattern: BeatPattern, voice: string): BeatLane | null;
export function patternHasHitAtStep(lane: BeatLane | null, step: number, stepsPerBeat: number): boolean;
export function chordTonePitch(chord: Chord, slot: number): number;
export function bassOctaveShift(rootPitch: number, bassWrapLow: number): number;
export function computeBassPitchForBlock(block: Block, chord: Chord, pattern: BeatPattern, bassWrapLow: number): number | null;

/** What a block shows: `degree` large (V7, ♭VI, V7/ii; a free chord's step, like III or ♭VI) and `name` small (G7, A♭). */
export function blockLabel(block: Block, masterRootIndex: number, masterModeIndex: number): { degree: string; name: string };

/** The Alter fields, in row order. */
export const ALTER_FIELDS: AlterField[];
/** The Alter rows an editor shows for a block (only tones the chord has; none on the leading-tone dim7). */
export function alterRows(block: Block, masterRootIndex: number, masterModeIndex: number): AlterRow[];
/** The block change for picking a value in an Alter row; the key's own value clears (undefined). */
export function alterChange(block: Block, field: AlterField, value: string, masterRootIndex: number, masterModeIndex: number): Partial<Block>;
/** The block keeping only the alterations its shape still has tones for. */
export function alterFitToShape(block: Block): Block;
/** The order editors list the Shape choices in, as extensionIndex values. */
export const SHAPE_ORDER: number[];
/** The numeral for a chromatic step above the key's root (a free chord's root); sharpen spells diminished chords with sharps. */
export function stepNumeral(step: number, sharpen?: boolean): string;
/** The block with every Alter choice cleared: what the key gives. */
export function withoutAlter(block: Block): Block;
