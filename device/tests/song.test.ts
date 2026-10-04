// The song model (sections, song order, linking and detaching) and the song write,
// run end to end: planSongWrite's messages go through the built wrapper into a fake
// Live set, and the test looks at the clips that end up on the fake tracks.
import { describe, expect, it } from "vitest";
import { defaultBlock } from "../../engine/src/engine.js";
import {
  DEFAULT_SONG,
  editingBlocks,
  layoutSong,
  normalizeSong,
  planSongWrite,
  withEditingBlocks,
  type Song,
} from "../src/app/chord-fiend-test/song";
import { fakeLive, loadWrapper } from "./fake-live.mjs";

function setup() {
  const live = fakeLive();
  const w = loadWrapper(live);
  const [c, b, d] = live.song.tracks;
  const song: Song = { ...DEFAULT_SONG, tracks: { chords: { id: c.id, name: c.name }, bass: { id: b.id, name: b.name }, drums: { id: d.id, name: d.name } } };
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
  it("places the song order end to end from the start bar", () => {
    const placed = layoutSong({ ...DEFAULT_SONG, startBar: 3 });
    expect(placed.map((p) => [p.label, p.start, p.length])).toEqual([
      ["Verse", 8, 16],
      ["Chorus", 24, 16],
      ["Verse", 40, 16],
      ["Chorus", 56, 16],
    ]);
  });

  it("editing a section changes every linked slot, and a detached slot keeps its own copy", () => {
    let s: Song = { ...DEFAULT_SONG, editing: { kind: "section", id: 1 } };
    s = { ...s, slots: s.slots.map((x) => (x.id === 5 ? { ...x, blocks: editingBlocks(s).map((b) => ({ ...b })) } : x)) }; // detach song part 3
    s = withEditingBlocks(s, [{ ...defaultBlock(), degreeIndex: 1 }]);
    const placed = layoutSong(s);
    expect(placed.map((p) => p.label)).toEqual(["Verse", "Chorus", "Verse*", "Chorus"]);
    expect(placed[0].blocks.map((b) => b.degreeIndex)).toEqual([1]);
    expect(placed[2].blocks.map((b) => b.degreeIndex)).toEqual([0, 5, 3, 4]);
    // editing a linked slot edits its section
    s = withEditingBlocks({ ...s, editing: { kind: "slot", id: 3 } }, [{ ...defaultBlock(), degreeIndex: 2 }]);
    expect(layoutSong(s)[0].blocks[0].degreeIndex).toBe(2);
    // editing the detached slot edits only it
    s = withEditingBlocks({ ...s, editing: { kind: "slot", id: 5 } }, [{ ...defaultBlock(), degreeIndex: 6 }]);
    expect(layoutSong(s).map((p) => p.blocks[0].degreeIndex)).toEqual([2, 3, 6, 3]);
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

  it("detaching a part renames its clips and keeps it out of later section edits", () => {
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

  it("tidies away a clip left by the first feel test", () => {
    const t = setup();
    const legacy = t.live.add({ kind: "Clip", name: "Chord Fiend: chords", start_time: 0, end_time: 16, notes: [] });
    t.c.arrangement_clips.push(legacy);
    t.write(t.song, true);
    expect(t.clips(t.c).map((x: any) => x[0])).not.toContain("Chord Fiend: chords");
    expect(t.c.arrangement_clips).toHaveLength(4);
  });
});
