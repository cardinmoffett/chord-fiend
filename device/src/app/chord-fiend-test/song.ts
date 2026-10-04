import {
  BLOCK_MODE_NAMES,
  EXTENSION_NAMES,
  MASTER_MODE_NAMES,
  buildChord,
  defaultBlock,
  degreeLabels,
  getChordSymbol,
  getDurationBeats,
  keyPrefersFlats,
  pitchToNoteName,
  type Block,
} from "../../../../engine/src/engine.js";
import { sectionToNotes, type Note } from "../../../../engine/src/notes.js";

export type { Block };
export type Role = "chords" | "bass" | "drums";
export const ROLES: Role[] = ["chords", "bass", "drums"];
export const BEATS_PER_BAR = 4;

export interface TrackRef {
  id: number;
  name: string;
}

/** A reusable part of the song: Intro, Verse, Chorus... */
export interface Section {
  id: number;
  name: string;
  blocks: Block[];
}

/**
 * One place in the song order (a "part"). A linked part plays its section's blocks, so
 * editing the section changes every part that uses it. An inline part has its own copy
 * (`blocks`), made with Make inline; Relink drops the copy and follows the section again.
 */
export interface Slot {
  id: number;
  sectionId: number;
  blocks: Block[] | null;
}

export type Editing = { kind: "section" | "slot"; id: number };

/** Everything the device remembers, saved in the Live Set. The window owns the song. */
export interface Song {
  version: 2;
  rootIndex: number;
  modeIndex: number;
  drumBeat: string;
  bassWrapLow: number;
  sections: Section[];
  slots: Slot[];
  nextId: number;
  editing: Editing;
  tracks: Record<Role, TrackRef | null>;
}

function blk(o: Partial<Block>): Block {
  return { ...defaultBlock(), ...o };
}

export const DEFAULT_SONG: Song = {
  version: 2,
  rootIndex: 0,
  modeIndex: 0,
  drumBeat: "rock",
  bassWrapLow: 28,
  sections: [
    { id: 1, name: "Verse", blocks: [blk({ degreeIndex: 0 }), blk({ degreeIndex: 5 }), blk({ degreeIndex: 3 }), blk({ degreeIndex: 4, extensionIndex: 2 })] },
    { id: 2, name: "Chorus", blocks: [blk({ degreeIndex: 3 }), blk({ degreeIndex: 4 }), blk({ degreeIndex: 0 }), blk({ degreeIndex: 5 })] },
  ],
  slots: [
    { id: 3, sectionId: 1, blocks: null },
    { id: 4, sectionId: 2, blocks: null },
    { id: 5, sectionId: 1, blocks: null },
    { id: 6, sectionId: 2, blocks: null },
  ],
  nextId: 7,
  editing: { kind: "section", id: 1 },
  tracks: { chords: null, bass: null, drums: null },
};

/**
 * Whatever the Set has saved, as a current Song. The first feel test saved a single
 * list of blocks (no `version`); that becomes one section placed once, so a Set saved
 * with it opens with its progression intact.
 */
export function normalizeSong(stored: unknown): Song {
  const s = stored as any;
  if (!s || typeof s !== "object") return DEFAULT_SONG;
  if (s.version === 2 && Array.isArray(s.sections) && s.sections.length) return s as Song;
  if (Array.isArray(s.blocks) && s.blocks.length) {
    const { blocks, ...rest } = s;
    return {
      ...DEFAULT_SONG,
      ...rest,
      version: 2,
      sections: [{ id: 1, name: "Verse", blocks }],
      slots: [{ id: 2, sectionId: 1, blocks: null }],
      nextId: 3,
      editing: { kind: "section", id: 1 },
      tracks: { ...DEFAULT_SONG.tracks, ...(s.tracks || {}) },
    };
  }
  return DEFAULT_SONG;
}

export function findSection(song: Song, id: number): Section | undefined {
  return song.sections.find((x) => x.id === id);
}

export function slotBlocks(song: Song, slot: Slot): Block[] {
  return slot.blocks ?? findSection(song, slot.sectionId)?.blocks ?? [];
}

export function slotLabel(song: Song, slot: Slot): string {
  const name = findSection(song, slot.sectionId)?.name ?? "?";
  return slot.blocks ? name + "*" : name;
}

/** The blocks the editor is currently pointed at, and whether they are shared by several slots. */
export function editingBlocks(song: Song): Block[] {
  if (song.editing.kind === "slot") {
    const slot = song.slots.find((x) => x.id === song.editing.id);
    if (slot) return slotBlocks(song, slot);
  }
  return findSection(song, song.editing.id)?.blocks ?? song.sections[0].blocks;
}

/** Is the editor showing a linked part? Then it is locked: Make inline to change that part. */
export function editingLocked(song: Song): boolean {
  if (song.editing.kind !== "slot") return false;
  const slot = song.slots.find((x) => x.id === song.editing.id);
  return !!slot && !slot.blocks;
}

/**
 * A copy of the song with the edited blocks replaced: the section's blocks, or an inline
 * part's own copy. A linked part is locked, so editing it changes nothing.
 */
export function withEditingBlocks(song: Song, blocks: Block[]): Song {
  let target = song.editing;
  if (target.kind === "slot") {
    const slot = song.slots.find((x) => x.id === target.id);
    if (!slot) target = { kind: "section", id: song.sections[0].id };
    else if (slot.blocks) return { ...song, slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks } : x)) };
    else return song;
  }
  return { ...song, sections: song.sections.map((x) => (x.id === target.id ? { ...x, blocks } : x)) };
}

export interface PlacedSlot {
  slot: Slot;
  index: number;
  label: string;
  /** Song position, in beats from the start of the Arrangement. */
  start: number;
  length: number;
  blockStarts: number[];
  blocks: Block[];
  notes: Record<Role, Note[]>;
}

/**
 * The song laid out on the Arrangement: slots end to end from bar 1.
 *
 * Bass is always written: muting it is Ableton's job, so a block's old bass setting
 * (bassToneIndex -1, from the app) is ignored here.
 */
export function layoutSong(song: Song): PlacedSlot[] {
  const settings = { rootIndex: song.rootIndex, modeIndex: song.modeIndex, drumBeat: song.drumBeat, bassEnabled: true, bassWrapLow: song.bassWrapLow };
  let cursor = 0;
  return song.slots.map((slot, index) => {
    const blocks = slotBlocks(song, slot);
    const n = sectionToNotes(
      blocks.map((b) => (b.bassToneIndex === -1 ? { ...b, bassToneIndex: 0 } : b)),
      settings,
    );
    const placed: PlacedSlot = {
      slot,
      index,
      label: slotLabel(song, slot),
      start: cursor,
      length: n.lengthBeats,
      blockStarts: n.blockStarts,
      blocks,
      notes: { chords: n.chords, bass: n.bass, drums: n.drums },
    };
    cursor += n.lengthBeats;
    return placed;
  });
}

/** What a placed slot's clip is called on a role's track. Unique per track, readable in Live. */
export function clipName(p: PlacedSlot, role: Role): string {
  return `${p.index + 1} ${p.label} - ${role}`;
}

export function blockLength(b: Block): number {
  return getDurationBeats(b);
}

export type WriteMessage = ["cf_prune" | "cf_write", Record<string, unknown>];

/**
 * The messages that put the song on the Arrangement, in order. For each role with a
 * track: one cf_prune (remove our clips that are no longer in the song), then a cf_write
 * for every clip that is new or changed since `lastSent` - or every clip, with `everything`.
 *
 * `lastSent` maps "<trackId>|<clip name>" to what was last written there; it is updated.
 */
export function planSongWrite(song: Song, lastSent: Map<string, string>, everything: boolean): { messages: WriteMessage[]; sent: number; same: number } {
  const layout = layoutSong(song);
  const messages: WriteMessage[] = [];
  let sent = 0;
  let same = 0;
  for (const role of ROLES) {
    const track = song.tracks[role];
    if (!track) continue;
    const trackId = track.id;
    // The tidy-up only runs when the layout (clip names and ranges) changed, so an edit that
    // changes nothing on the Arrangement - selecting a block, say - sends nothing at all.
    const keep = layout.map((p) => ({ name: clipName(p, role), start: p.start, length: p.length }));
    const keepKey = `${trackId}|#layout`;
    const keepSig = JSON.stringify(keep);
    if (everything || lastSent.get(keepKey) !== keepSig) messages.push(["cf_prune", { role, trackId, keep }]);
    lastSent.set(keepKey, keepSig);
    const live = new Set<string>([keepKey]);
    for (const p of layout) {
      const name = clipName(p, role);
      const key = `${trackId}|${name}`;
      const rows = p.notes[role].map((n) => [n.pitch, n.start, n.duration, n.velocity]);
      const color = sectionColor(p.slot.sectionId).live;
      const sig = JSON.stringify([p.start, p.length, color, rows]);
      live.add(key);
      if (!everything && lastSent.get(key) === sig) {
        same++;
        continue;
      }
      messages.push(["cf_write", { role, name, trackId, start: p.start, length: p.length, color, notes: rows }]);
      lastSent.set(key, sig);
      sent++;
    }
    for (const key of [...lastSent.keys()]) if (key.startsWith(`${trackId}|`) && !live.has(key)) lastSent.delete(key);
  }
  return { messages, sent, same };
}

/* ---------------- colours ---------------- */

// One colour per section, used in the window and for its clips in Live. Live snaps a clip
// colour to the nearest one in its own palette, so these are picked to stay distinct after that.
const SECTION_COLORS = ["#e0a33a", "#4f9bd9", "#5cb85c", "#d9534f", "#9b6bd6", "#3fb5a8", "#e07a3a", "#c4b13a"];

export function sectionColor(sectionId: number): { css: string; live: number } {
  const hex = SECTION_COLORS[(sectionId - 1 + SECTION_COLORS.length * 100) % SECTION_COLORS.length];
  return { css: hex, live: parseInt(hex.slice(1), 16) };
}

// A block's colour follows the app's blockHSL with its "Sunset" palette: hue from the degree
// (an applied chord takes its target's hue, a touch darker), saturation from the extension,
// lightness lowered a little by aug and sus. A free chord is not a degree of the key, so it is grey.
const DEGREE_HUES = [42, 205, 155, 28, 348, 265, 322];
const EXTENSION_SATURATION = [46, 54, 62, 70, 78, 86];

export function blockColor(b: Block): string {
  if (b.chordSource === "free") return `hsl(220 8% ${b.aug ? 40 : 46}%)`;
  const applied = b.chordSource === "applied";
  const hue = DEGREE_HUES[(applied ? b.appliedTargetIndex : b.degreeIndex) || 0];
  const sat = EXTENSION_SATURATION[b.extensionIndex] ?? 46;
  let light = 53;
  if (b.aug) light -= 6;
  if (b.susIndex > 0) light -= 4;
  if (applied) light -= 8;
  return `hsl(${hue} ${sat}% ${Math.max(26, Math.min(66, light))}%)`;
}

/* ---------------- block labels ---------------- */

const FUNCTION_SHORT: Record<string, string> = { dominant: "V", tritoneSub: "subV", leadingTone: "vii\u00B0" };
const QUALITY_SHORT: Record<string, string> = { major: "", minor: "m", dominant: "7", diminished: "\u00B0" };

/**
 * What a block shows: `degree` large (the chord's job in the key: V7, \u266DVI, V/ii) and
 * `name` small (the chord itself: G7, A\u266D, A7).
 */
export function blockLabel(b: Block, song: Song): { degree: string; name: string } {
  const chord = buildChord(b, song.rootIndex, song.modeIndex);
  const name = getChordSymbol(chord, song.rootIndex).replace(/ \(.*\)$/, "");
  const ext = EXTENSION_NAMES[b.extensionIndex];
  const extMark = ext === "triad" ? "" : ext;
  const susMark = b.susIndex === 1 ? "sus2" : b.susIndex === 2 ? "sus4" : "";
  const fifthMark = chord.aug ? "+" : chord.flat5 ? "\u266D5" : "";
  let degree: string;
  if (b.chordSource === "applied") {
    const target = degreeLabels(MASTER_MODE_NAMES[song.modeIndex])[b.appliedTargetIndex] ?? "?";
    const fn = FUNCTION_SHORT[b.appliedFunction] ?? "V";
    degree = `${fn}${b.appliedFunction === "leadingTone" ? "7" : extMark}${susMark}${fifthMark}/${target}`;
  } else if (b.chordSource === "free") {
    const root = pitchToNoteName(b.freeRoot ?? 0, keyPrefersFlats(song.rootIndex, song.modeIndex)).replace("#", "\u266F");
    const q = b.freeQuality ?? "major";
    const qMark = q === "dominant" ? (extMark || "7") : QUALITY_SHORT[q] + (q === "major" && extMark && extMark !== "6" ? "maj" + extMark : extMark);
    degree = `${root}${qMark}${susMark}${fifthMark}`;
  } else {
    const mode = b.blockModeIndex ? BLOCK_MODE_NAMES[b.blockModeIndex] : MASTER_MODE_NAMES[song.modeIndex];
    degree = `${degreeLabels(mode)[b.degreeIndex]}${extMark}${susMark}${fifthMark}`;
  }
  return { degree, name };
}
