// Types for notes.js.
import type { Block, BeatPattern } from './engine.js';

export interface Note { pitch: number; start: number; duration: number; velocity: number }

export interface SectionSettings {
  rootIndex?: number;
  modeIndex?: number;
  drumBeat?: string;
  customBeatPatterns?: Record<string, BeatPattern> | null;
  bassEnabled?: boolean;
  bassWrapLow?: number;
  drumMap?: Partial<Record<'kick' | 'snare' | 'hihat', number>>;
  chordVelocity?: number;
  bassVelocity?: number;
  drumVelocity?: number;
  drumHitBeats?: number;
}

export interface SectionNotes {
  lengthBeats: number;
  blockStarts: number[];
  chords: Note[];
  bass: Note[];
  drums: Note[];
}

export const DEFAULT_DRUM_MAP: { kick: number; snare: number; hihat: number };
export const DRUM_VOICES: string[];
export function sectionToNotes(blocks: Block[], settings?: SectionSettings): SectionNotes;
