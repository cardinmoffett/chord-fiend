import { defaultBlock, getDurationBeats, type Block } from "../../../../engine/src/engine.js";
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
 * One place in the song order. A linked slot plays its section's blocks, so editing the
 * section changes every slot that uses it. A detached slot has its own copy (`blocks`).
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
  bassEnabled: boolean;
  bassWrapLow: number;
  startBar: number;
  autoWrite: boolean;
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
  bassEnabled: true,
  bassWrapLow: 28,
  startBar: 1,
  autoWrite: true,
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

/** A copy of the song with the edited blocks replaced. Editing a linked slot edits its section. */
export function withEditingBlocks(song: Song, blocks: Block[]): Song {
  let target = song.editing;
  if (target.kind === "slot") {
    const slot = song.slots.find((x) => x.id === target.id);
    if (!slot) target = { kind: "section", id: song.sections[0].id };
    else if (slot.blocks) return { ...song, slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks } : x)) };
    else target = { kind: "section", id: slot.sectionId };
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

/** The song laid out on the Arrangement: slots end to end from the start bar. */
export function layoutSong(song: Song): PlacedSlot[] {
  const settings = { rootIndex: song.rootIndex, modeIndex: song.modeIndex, drumBeat: song.drumBeat, bassEnabled: song.bassEnabled, bassWrapLow: song.bassWrapLow };
  let cursor = (Math.max(1, song.startBar) - 1) * BEATS_PER_BAR;
  return song.slots.map((slot, index) => {
    const blocks = slotBlocks(song, slot);
    const n = sectionToNotes(blocks, settings);
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
    messages.push(["cf_prune", { role, trackId, keep: layout.map((p) => ({ name: clipName(p, role), start: p.start, length: p.length })) }]);
    const live = new Set<string>();
    for (const p of layout) {
      const name = clipName(p, role);
      const key = `${trackId}|${name}`;
      const rows = p.notes[role].map((n) => [n.pitch, n.start, n.duration, n.velocity]);
      const sig = JSON.stringify([p.start, p.length, rows]);
      live.add(key);
      if (!everything && lastSent.get(key) === sig) {
        same++;
        continue;
      }
      messages.push(["cf_write", { role, name, trackId, start: p.start, length: p.length, notes: rows }]);
      lastSent.set(key, sig);
      sent++;
    }
    for (const key of [...lastSent.keys()]) if (key.startsWith(`${trackId}|`) && !live.has(key)) lastSent.delete(key);
  }
  return { messages, sent, same };
}
