import {
  BUILTIN_BEAT_PATTERNS,
  appliedColorDegrees,
  blockLabel as engineBlockLabel,
  defaultBeatForMeter,
  defaultBlock,
  getDurationBeats,
  type Block,
} from "../../../../engine/src/engine.js";
import { sectionToNotes, type Note } from "../../../../engine/src/notes.js";

export type { Block };
export type Role = "chords" | "bass" | "drums";
export const ROLES: Role[] = ["chords", "bass", "drums"];
/** The time signatures the song can be in: 4/4 or 3/4, following Live's. */
export type Meter = 3 | 4;

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
 * (`blocks`), made with Edit instance. There is deliberately no way back to the old section
 * (a Relink would throw the part's own chords away): New linked section turns the copy into
 * a section of its own instead.
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
  /** Beats per bar, taken from Live's time signature (3/4 or 4/4). */
  beatsPerBar: Meter;
  bassWrapLow: number;
  sections: Section[];
  slots: Slot[];
  nextId: number;
  editing: Editing;
  tracks: Record<Role, TrackRef | null>;
}

/**
 * A new device starts with no song: one section holding the key's I chord (the section
 * editor always shows at least one chord), and nothing placed in the song yet. This is
 * how the app started a new project too.
 */
export const DEFAULT_SONG: Song = {
  version: 2,
  rootIndex: 0,
  modeIndex: 0,
  drumBeat: "rock",
  beatsPerBar: 4,
  bassWrapLow: 28,
  sections: [{ id: 1, name: "Section 1", blocks: [defaultBlock()] }],
  slots: [],
  nextId: 2,
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
  if (s.version === 2 && Array.isArray(s.sections) && s.sections.length) return s.beatsPerBar === 3 || s.beatsPerBar === 4 ? (s as Song) : { ...s, beatsPerBar: 4 };
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

/** Is the editor showing a linked part? Then it is locked: Edit source or Edit instance to change it. */
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

/* ---------------- linked parts ---------------- */

/** Edit instance: the part gets its own copy of its section's chords, edited on its own. */
export function inlineSlot(song: Song, slotId: number): Song {
  const slot = song.slots.find((x) => x.id === slotId);
  if (!slot || slot.blocks) return song;
  const copy = (findSection(song, slot.sectionId)?.blocks ?? []).map((b) => ({ ...b }));
  return { ...song, slots: song.slots.map((x) => (x.id === slotId ? { ...x, blocks: copy } : x)) };
}

/**
 * New linked section: an inline part's chords become a new section, and the part is linked
 * to it. The section takes the old section's name, numbered so it stays distinct (Verse 2).
 */
export function slotToNewSection(song: Song, slotId: number): Song {
  const slot = song.slots.find((x) => x.id === slotId);
  if (!slot || !slot.blocks) return song;
  const base = findSection(song, slot.sectionId)?.name ?? "Section";
  let name = base;
  for (let n = 2; song.sections.some((x) => x.name === name); n++) name = `${base} ${n}`;
  const id = song.nextId;
  return {
    ...song,
    sections: [...song.sections, { id, name, blocks: slot.blocks.map((b) => ({ ...b })) }],
    slots: song.slots.map((x) => (x.id === slotId ? { ...x, sectionId: id, blocks: null } : x)),
    nextId: id + 1,
  };
}

/* ---------------- time signature ---------------- */

/** Live's time signature as the song's meter: 3/4 is 3, everything else is treated as 4/4. */
export function meterFromLive(numerator: number, denominator: number): Meter {
  return numerator === 3 && denominator === 4 ? 3 : 4;
}

/** A new chord, one bar long in the song's meter (a dotted half in 3/4). */
export function barBlock(beats: Meter): Block {
  const b = defaultBlock();
  if (beats === 3) {
    b.durationIndex = 3;
    b.durationModifier = 1;
  }
  return b;
}

function isOneBar(b: Block, beats: number): boolean {
  return Math.abs(getDurationBeats(b) - beats) < 1e-9 && !(b as any).durationMult;
}

/**
 * The song in another meter, as the app's time signature setting does it: chords a bar long
 * stay a bar long (whole note <-> dotted half), and a beat from the other meter gives way to
 * the new meter's default (Rock <-> Waltz). Everything else keeps its length in beats.
 */
export function setMeter(song: Song, beats: Meter): Song {
  const old = song.beatsPerBar;
  if (beats === old) return song;
  const fit = (blocks: Block[]) =>
    blocks.map((b) => (isOneBar(b, old) ? { ...b, ...(beats === 3 ? { durationIndex: 3, durationModifier: 1 } : { durationIndex: 2, durationModifier: 0 }) } : b));
  const pattern = BUILTIN_BEAT_PATTERNS[song.drumBeat];
  return {
    ...song,
    beatsPerBar: beats,
    drumBeat: song.drumBeat !== "off" && (!pattern || pattern.loopBeats !== beats) ? defaultBeatForMeter(beats) : song.drumBeat,
    sections: song.sections.map((x) => ({ ...x, blocks: fit(x.blocks) })),
    slots: song.slots.map((x) => (x.blocks ? { ...x, blocks: fit(x.blocks) } : x)),
  };
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

function blendHues(a: number, b: number): number {
  const d = ((b - a + 540) % 360) - 180; // the short way round the color wheel
  return Math.round((a + d / 2 + 360) % 360);
}

export function blockColor(b: Block): string {
  if (b.chordSource === "free") return `hsl(220 8% ${b.aug ? 40 : 46}%)`;
  const applied = b.chordSource === "applied";
  // A mediant sits between two degrees (\u266DIII between ii and iii) and blends their hues.
  const near = (applied ? appliedColorDegrees(b) : [b.degreeIndex || 0]).map((d) => DEGREE_HUES[d]);
  const hue = near.length > 1 ? blendHues(near[0], near[1]) : near[0];
  const sat = EXTENSION_SATURATION[b.extensionIndex] ?? 46;
  let light = 53;
  if (b.aug) light -= 6;
  if (b.susIndex > 0) light -= 4;
  if (applied) light -= 8;
  return `hsl(${hue} ${sat}% ${Math.max(26, Math.min(66, light))}%)`;
}

/* ---------------- block labels ---------------- */

/**
 * What a block shows: `degree` large (the chord's job in the key: V7, \u266DVI, V/ii) and
 * `name` small (the chord itself: G7, A\u266D, A7). Shared with the phone app via the engine.
 */
export function blockLabel(b: Block, song: Song): { degree: string; name: string } {
  return engineBlockLabel(b, song.rootIndex, song.modeIndex);
}
