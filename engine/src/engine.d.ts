// Types for engine.js, for TypeScript callers such as the device. engine.js stays plain JavaScript.

export interface Block {
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
  /** Free mode's root, as a pitch class 0-11. An engine addition. */
  freeRoot?: number;
  /** Free mode's quality. An engine addition; missing means major. */
  freeQuality?: "major" | "minor" | "dominant";
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
export const FREE_QUALITIES: ("major" | "minor" | "dominant")[];
export const FREE_QUALITY_INTERVALS: Record<string, number[]>;
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
