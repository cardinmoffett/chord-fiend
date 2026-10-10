// The song model (sections, song order, linking and detaching) and the song write,
// run end to end: planSongWrite's messages go through the built wrapper into a fake
// Live set, and the test looks at the clips that end up on the fake tracks.
import { describe, expect, it } from "vitest";
import { defaultBlock } from "../../engine/src/engine.js";
import type { Block } from "../../engine/src/engine.js";
import {
  DEFAULT_SONG,
  blockLabel,
  editingBlocks,
  editingLocked,
  layoutSong,
  normalizeSong,
  planSongWrite,
  sectionColor,
  withEditingBlocks,
  type Song,
} from "../src/app/chord-fiend-test/song";
import { fakeLive, loadWrapper } from "./fake-live.mjs";

// The sample song the earlier feel tests started with: Verse, Chorus, Verse, Chorus.
const blk = (o: Partial<Block>): Block => ({ ...defaultBlock(), ...o });
const SAMPLE: Song = {
  ...DEFAULT_SONG,
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
};

function setup() {
  const live = fakeLive();
  const w = loadWrapper(live);
  const [c, b, d] = live.song.tracks;
  const song: Song = { ...SAMPLE, tracks: { chords: { id: c.id, name: c.name }, bass: { id: b.id, name: b.name }, drums: { id: d.id, name: d.name } } };
  const lastSent = new Map<string, string>();
  const write = (s: Song, everything = false) => {
    const plan = planSongWrite(s, lastSent, everything);
    for (const [selector, payload] of plan.messages) w.send(selector, w.b64(payload));
    return plan;
  };
  const clips = (t: any) => t.arrangement_clips.map((x: any) => [x.name, x.start_time, x.end_time]).sort((p: any, q: any) => p[1] - q[1]);
  return { live, w, c, b, d, song, write, clips };
}

describe("song layout", () => {
  it("places the song order end to end from bar 1", () => {
    const placed = layoutSong(SAMPLE);
    expect(placed.map((p) => [p.label, p.start, p.length])).toEqual([
      ["Verse", 0, 16],
      ["Chorus", 16, 16],
      ["Verse", 32, 16],
      ["Chorus", 48, 16],
    ]);
  });

  it("always writes bass: a block's old bass-off setting from the app is ignored", () => {
    const s = withEditingBlocks({ ...SAMPLE, editing: { kind: "section", id: 1 } }, [{ ...defaultBlock(), bassToneIndex: -1 }]);
    expect(layoutSong(s)[0].notes.bass.length).toBe(4);
  });

  it("editing a section changes every linked part, and an inline part keeps its own copy", () => {
    let s: Song = { ...SAMPLE, editing: { kind: "section", id: 1 } };
    s = { ...s, slots: s.slots.map((x) => (x.id === 5 ? { ...x, blocks: editingBlocks(s).map((b) => ({ ...b })) } : x)) }; // detach song part 3
    s = withEditingBlocks(s, [{ ...defaultBlock(), degreeIndex: 1 }]);
    const placed = layoutSong(s);
    expect(placed.map((p) => p.label)).toEqual(["Verse", "Chorus", "Verse*", "Chorus"]);
    expect(placed[0].blocks.map((b) => b.degreeIndex)).toEqual([1]);
    expect(placed[2].blocks.map((b) => b.degreeIndex)).toEqual([0, 5, 3, 4]);
    // a linked part opens locked: editing it changes nothing
    const lockedSong = { ...s, editing: { kind: "slot" as const, id: 3 } };
    expect(editingLocked(lockedSong)).toBe(true);
    expect(withEditingBlocks(lockedSong, [{ ...defaultBlock(), degreeIndex: 2 }])).toBe(lockedSong);
    // an inline part is not locked, and editing it edits only it
    s = { ...s, editing: { kind: "slot", id: 5 } };
    expect(editingLocked(s)).toBe(false);
    s = withEditingBlocks(s, [{ ...defaultBlock(), degreeIndex: 6 }]);
    expect(layoutSong(s).map((p) => p.blocks[0].degreeIndex)).toEqual([1, 3, 6, 3]);
  });

  it("a new device starts with no song: one section with the I chord, nothing placed", () => {
    expect(DEFAULT_SONG.slots).toEqual([]);
    expect(DEFAULT_SONG.sections.map((x) => [x.name, x.blocks])).toEqual([["Section 1", [defaultBlock()]]]);
    expect(layoutSong(DEFAULT_SONG)).toEqual([]);
  });

  it("opens a Set saved by the first feel test as one section placed once", () => {
    const old = { rootIndex: 2, modeIndex: 5, drumBeat: "latin", blocks: [{ ...defaultBlock(), degreeIndex: 3 }], tracks: { chords: { id: 7, name: "Keys" } } };
    const s = normalizeSong(old);
    expect([s.rootIndex, s.modeIndex, s.drumBeat]).toEqual([2, 5, "latin"]);
    expect(s.sections.map((x) => [x.name, x.blocks.length])).toEqual([["Verse", 1]]);
    expect(s.slots).toHaveLength(1);
    expect(s.tracks).toEqual({ chords: { id: 7, name: "Keys" }, bass: null, drums: null });
    expect(normalizeSong(undefined)).toBe(DEFAULT_SONG);
  });
});

describe("writing the song to a fake Live set", () => {
  it("writes one clip per song part on each track, named for the part", () => {
    const t = setup();
    t.write(t.song, true);
    expect(t.clips(t.c)).toEqual([
      ["Chord Fiend: 1 Verse - chords", 0, 16],
      ["Chord Fiend: 2 Chorus - chords", 16, 32],
      ["Chord Fiend: 3 Verse - chords", 32, 48],
      ["Chord Fiend: 4 Chorus - chords", 48, 64],
    ]);
    expect(t.clips(t.d).map((x: any) => x[0])).toEqual(["Chord Fiend: 1 Verse - drums", "Chord Fiend: 2 Chorus - drums", "Chord Fiend: 3 Verse - drums", "Chord Fiend: 4 Chorus - drums"]);
    // the chords of song part 2 (Chorus: IV V I vi) start with F major
    // each section's clips take its colour (Verse is section 1, Chorus section 2)
    expect(t.c.arrangement_clips.map((x: any) => x.color)).toEqual([sectionColor(1).live, sectionColor(2).live, sectionColor(1).live, sectionColor(2).live]);
    expect(sectionColor(1).live).not.toBe(sectionColor(2).live);
    const chorus = t.c.arrangement_clips.find((x: any) => x.name.includes("2 Chorus"));
    expect(chorus.notes.filter((n: any) => n.start_time === 0).map((n: any) => n.pitch)).toEqual([65, 69, 72]);
  });

  it("an edit to a section rewrites only the parts that use it, in place", () => {
    const t = setup();
    t.write(t.song, true);
    const ids = t.c.arrangement_clips.map((x: any) => x.id);
    const before = t.live.calls.length;
    const edited = withEditingBlocks({ ...t.song, editing: { kind: "section", id: 1 } }, [{ ...defaultBlock(), degreeIndex: 1 }, ...editingBlocks(t.song).slice(1)]);
    const plan = t.write(edited);
    // chords and bass for the two Verses; the drums do not depend on the chords, so they are unchanged
    expect([plan.sent, plan.same]).toEqual([4, 8]);
    expect(t.c.arrangement_clips.map((x: any) => x.id)).toEqual(ids); // same clips, notes replaced
    const calls = t.live.calls.slice(before);
    expect(calls.filter((x: any) => x[0] === "create_midi_clip" || x[0] === "delete_clip")).toEqual([]);
    const verse = t.c.arrangement_clips.find((x: any) => x.name.includes("1 Verse"));
    expect(verse.notes.filter((n: any) => n.start_time === 0).map((n: any) => n.pitch)).toEqual([62, 65, 69]); // D minor
  });

  it("a change that does not touch the Arrangement sends nothing", () => {
    const t = setup();
    t.write(t.song, true);
    const plan = t.write({ ...t.song, editing: { kind: "section", id: 2 } });
    expect(plan.messages).toEqual([]);
  });

  it("reordering and removing parts moves the clips, with no leftovers", () => {
    const t = setup();
    const theirs = t.live.add({ kind: "Clip", name: "my riff", start_time: 100, end_time: 104, notes: [] });
    t.c.arrangement_clips.push(theirs);
    t.write(t.song, true);
    const swapped = { ...t.song, slots: [t.song.slots[1], t.song.slots[0], ...t.song.slots.slice(2)] };
    t.write(swapped);
    expect(t.clips(t.c).map((x: any) => x[0])).toEqual([
      "Chord Fiend: 1 Chorus - chords",
      "Chord Fiend: 2 Verse - chords",
      "Chord Fiend: 3 Verse - chords",
      "Chord Fiend: 4 Chorus - chords",
      "my riff",
    ]);
    const shorter = { ...swapped, slots: swapped.slots.slice(0, 2) };
    t.write(shorter);
    expect(t.clips(t.b).map((x: any) => [x[0], x[1], x[2]])).toEqual([
      ["Chord Fiend: 1 Chorus - bass", 0, 16],
      ["Chord Fiend: 2 Verse - bass", 16, 32],
    ]);
    expect(t.clips(t.c).map((x: any) => x[0])).toContain("my riff");
  });

  it("a longer chord pushes every later part along the timeline", () => {
    const t = setup();
    t.write(t.song, true);
    const blocks = editingBlocks({ ...t.song, editing: { kind: "section", id: 2 } });
    const longer = withEditingBlocks({ ...t.song, editing: { kind: "section", id: 2 } }, [{ ...blocks[0], durationIndex: 1 }, ...blocks.slice(1)]); // first Chorus chord: 2 bars
    t.write(longer);
    expect(t.clips(t.c).map((x: any) => [x[0].replace("Chord Fiend: ", ""), x[1], x[2]])).toEqual([
      ["1 Verse - chords", 0, 16],
      ["2 Chorus - chords", 16, 36],
      ["3 Verse - chords", 36, 52],
      ["4 Chorus - chords", 52, 72],
    ]);
  });

  it("making a part inline renames its clips and keeps it out of later section edits", () => {
    const t = setup();
    t.write(t.song, true);
    let s: Song = { ...t.song, slots: t.song.slots.map((x) => (x.id === 5 ? { ...x, blocks: editingBlocks(t.song).map((b) => ({ ...b })) } : x)) };
    t.write(s);
    expect(t.clips(t.c).map((x: any) => x[0])[2]).toBe("Chord Fiend: 3 Verse* - chords");
    const verse = editingBlocks({ ...s, editing: { kind: "section", id: 1 } });
    s = withEditingBlocks({ ...s, editing: { kind: "section", id: 1 } }, [{ ...verse[0], degreeIndex: 6 }, ...verse.slice(1)]); // same length
    const plan = t.write(s);
    expect(plan.sent).toBe(2); // chords and bass of song part 1 only; the detached part 3 is untouched
  });

  it("removing every part leaves no Chord Fiend clips, and other clips stay", () => {
    const t = setup();
    const theirs = t.live.add({ kind: "Clip", name: "my riff", start_time: 100, end_time: 104, notes: [] });
    t.c.arrangement_clips.push(theirs);
    t.write(t.song, true);
    t.write({ ...t.song, slots: [] });
    expect([t.c, t.b, t.d].map((tr: any) => tr.arrangement_clips.map((x: any) => x.name))).toEqual([["my riff"], [], []]);
  });

  it("tidies away a clip left by the first feel test", () => {
    const t = setup();
    const legacy = t.live.add({ kind: "Clip", name: "Chord Fiend: chords", start_time: 0, end_time: 16, notes: [] });
    t.c.arrangement_clips.push(legacy);
    t.write(t.song, true);
    expect(t.clips(t.c).map((x: any) => x[0])).not.toContain("Chord Fiend: chords");
    expect(t.c.arrangement_clips).toHaveLength(4);
  });
});

describe("block labels: the degree large, the chord name small", () => {
  const b = (o: object) => ({ ...defaultBlock(), ...o });
  const label = (o: object, song: Song = DEFAULT_SONG) => blockLabel(b(o), song);
  it("diatonic", () => {
    expect(label({ degreeIndex: 4, extensionIndex: 2 })).toEqual({ degree: "V7", name: "G7" });
    expect(label({ degreeIndex: 1 })).toEqual({ degree: "ii", name: "Dm" });
    expect(label({ degreeIndex: 0, susIndex: 2 }).degree).toBe("Isus4");
    // On the rails: a diatonic chord takes its notes from the scale, so b5 / #5 don't apply.
    expect(label({ degreeIndex: 4, extensionIndex: 2, flat5: 1 })).toEqual({ degree: "V7", name: "G7" });
    expect(label({ degreeIndex: 0, aug: 1 }).degree).toBe("I");
  });
  it("applied and free chords take a fifth and tensions", () => {
    expect(label({ chordSource: "applied", appliedTargetIndex: 0, appliedFunction: "dominant", extensionIndex: 2, flat5: 1 })).toEqual({ degree: "V7\u266D5/I", name: "G7b5" });
    expect(label({ chordSource: "free", freeRoot: 0, freeQuality: "augmented" }).degree).toBe("C+");
    expect(label({ chordSource: "applied", appliedTargetIndex: 1, appliedFunction: "dominant", extensionIndex: 3, tension: "b9" })).toEqual({ degree: "V7(\u266D9)/ii", name: "A7(b9)" });
  });
  it("a borrowed chord shows its degree in the borrowed mode", () => {
    expect(label({ degreeIndex: 5, blockModeIndex: 6 })).toEqual({ degree: "\u266DVI", name: "A\u266D" });
  });
  it("applied", () => {
    expect(label({ chordSource: "applied", appliedFunction: "dominant", appliedTargetIndex: 4, extensionIndex: 2 })).toEqual({ degree: "V7/V", name: "D7" });
    expect(label({ chordSource: "applied", appliedFunction: "tritoneSub", appliedTargetIndex: 0, extensionIndex: 2 }).degree).toBe("subV7/I");
    expect(label({ chordSource: "applied", appliedFunction: "leadingTone", appliedTargetIndex: 4 }).degree).toBe("vii\u00B07/V");
  });
  it("free", () => {
    expect(label({ chordSource: "free", freeRoot: 4, freeQuality: "major" })).toEqual({ degree: "E", name: "E" });
    expect(label({ chordSource: "free", freeRoot: 5, freeQuality: "minor", extensionIndex: 2 }).degree).toBe("Fm7");
    expect(label({ chordSource: "free", freeRoot: 0, freeQuality: "major", extensionIndex: 2 }).degree).toBe("Cmaj7");
    // A dominant triad is B\u266D-D-F with no 7th, so it reads as B\u266D until a 7th is added.
    expect(label({ chordSource: "free", freeRoot: 10, freeQuality: "dominant" }, { ...DEFAULT_SONG, rootIndex: 5 }).degree).toBe("B\u266D");
    expect(label({ chordSource: "free", freeRoot: 10, freeQuality: "dominant", extensionIndex: 2 }, { ...DEFAULT_SONG, rootIndex: 5 }).degree).toBe("B\u266D7");
    expect(label({ chordSource: "free", freeRoot: 11, freeQuality: "diminished", extensionIndex: 2 })).toEqual({ degree: "B\u00B07", name: "Bdim7" });
  });
});
