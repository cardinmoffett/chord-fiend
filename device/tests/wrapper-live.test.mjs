// Runs the built wrapper.js (the packaged wrapper plus our wrapper/device.ts) against a
// FAKE Max and a FAKE Live set, to check the feel test's Live-side logic: listing
// tracks, writing, replacing and clearing Arrangement clips, and the transport.
//
// The fake is our belief about the Live API, taken from the Live Object Model docs, so
// passing here does not prove Live behaves the same - that is what the test in Live is for.
// Run `pnpm build` first.
import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { fakeLive, loadWrapper as load } from "./fake-live.mjs";

const notes = (n, start = 0) => Array.from({ length: n }, (_, i) => [60 + i, start + i, 1, 100]);

describe("feel test wrapper against a fake Live set", () => {
  it("lists tracks to the editor window, with names that have spaces and accents", () => {
    const live = fakeLive();
    live.song.tracks[3].name = "Vóx 2";
    const w = load(live);
    w.send("cf_tracks");
    const [tracks] = w.replies("cf_tracks");
    expect(tracks.map((t) => t.name)).toEqual(["Chords", "Bass Line", "Drums", "Vóx 2"]);
    expect(tracks.map((t) => t.midi)).toEqual([true, true, true, false]);
    expect(tracks[0].id).toBe(live.song.tracks[0].id);
  });

  it("creates a tagged Arrangement clip at the start and length asked, with the notes", () => {
    const live = fakeLive();
    const w = load(live);
    const chords = live.song.tracks[0];
    w.send("cf_write", w.b64({ role: "chords", trackId: chords.id, start: 8, length: 16, notes: notes(3) }));
    expect(chords.arrangement_clips).toHaveLength(1);
    const clip = chords.arrangement_clips[0];
    expect([clip.name, clip.start_time, clip.end_time]).toEqual(["Chord Fiend: chords", 8, 24]);
    expect(clip.notes.map((n) => [n.pitch, n.start_time, n.duration, n.velocity, n.mute])).toEqual([
      [60, 0, 1, 100, 0],
      [61, 1, 1, 100, 0],
      [62, 2, 1, 100, 0],
    ]);
    expect(w.replies("cf_result")[0]).toMatchObject({ role: "chords", ok: true, action: "created", notes: 3 });
  });

  it("replaces the notes in place when the range is unchanged (the mid-loop rewrite)", () => {
    const live = fakeLive();
    const w = load(live);
    const chords = live.song.tracks[0];
    w.send("cf_write", w.b64({ role: "chords", trackId: chords.id, start: 0, length: 16, notes: notes(4) }));
    const firstId = chords.arrangement_clips[0].id;
    w.send("cf_write", w.b64({ role: "chords", trackId: chords.id, start: 0, length: 16, notes: [[72, 0, 4, 90]] }));
    expect(chords.arrangement_clips.map((c) => c.id)).toEqual([firstId]);
    expect(chords.arrangement_clips[0].notes.map((n) => n.pitch)).toEqual([72]);
    expect(live.calls.filter((c) => c[0] === "delete_clip")).toHaveLength(0);
    expect(w.replies("cf_result")[1]).toMatchObject({ ok: true, action: "replaced", clipId: firstId });
  });

  it("deletes our old clip and makes a new one when the length changes, leaving other clips alone", () => {
    const live = fakeLive();
    const w = load(live);
    const chords = live.song.tracks[0];
    const theirs = live.add({ kind: "Clip", name: "My own clip", start_time: 32, end_time: 36, notes: [] });
    chords.arrangement_clips.push(theirs);
    w.send("cf_write", w.b64({ role: "chords", trackId: chords.id, start: 0, length: 16, notes: notes(2) }));
    w.send("cf_write", w.b64({ role: "chords", trackId: chords.id, start: 0, length: 20, notes: notes(2) }));
    expect(chords.arrangement_clips.map((c) => [c.name, c.end_time])).toEqual([
      ["My own clip", 36],
      ["Chord Fiend: chords", 20],
    ]);
    expect(w.replies("cf_result")[1]).toMatchObject({ ok: true, action: "recreated", deleted: 1 });
  });

  it("writes three roles to three tracks, and clear removes only our clips", () => {
    const live = fakeLive();
    const w = load(live);
    const [c, b, d] = live.song.tracks;
    const theirs = live.add({ kind: "Clip", name: "keep me", start_time: 40, end_time: 44, notes: [] });
    d.arrangement_clips.push(theirs);
    for (const [role, t] of [["chords", c], ["bass", b], ["drums", d]]) w.send("cf_write", w.b64({ role, trackId: t.id, start: 0, length: 8, notes: notes(2) }));
    expect([c, b, d].map((t) => t.arrangement_clips.map((x) => x.name))).toEqual([["Chord Fiend: chords"], ["Chord Fiend: bass"], ["keep me", "Chord Fiend: drums"]]);
    w.send("cf_clear", w.b64({ trackIds: [c.id, b.id, d.id] }));
    expect([c, b, d].map((t) => t.arrangement_clips.map((x) => x.name))).toEqual([[], [], ["keep me"]]);
    expect(w.replies("cf_result").at(-1)).toMatchObject({ role: "clear", ok: true, deleted: 3 });
  });

  it("reports a missing track instead of throwing", () => {
    const live = fakeLive();
    const w = load(live);
    w.send("cf_write", w.b64({ role: "bass", trackId: 9999, start: 0, length: 8, notes: notes(1) }));
    expect(w.replies("cf_result")[0]).toMatchObject({ role: "bass", ok: false });
  });

  it("loops a range from the window, then restores the user's own loop on stop", () => {
    const live = fakeLive();
    const w = load(live);
    w.send("cf_loop", 4, 4);
    expect([live.song.loop, live.song.loop_start, live.song.loop_length, live.song.current_song_time, live.song.is_playing, live.song.back_to_arranger]).toEqual([1, 4, 4, 4, 1, 0]);
    w.send("cf_loop", 8, 4); // a second preview must not overwrite the saved user loop
    w.send("cf_stop");
    expect([live.song.loop, live.song.loop_start, live.song.loop_length, live.song.is_playing]).toEqual([1, 16, 8, 0]);
  });

  it("forwards the transport tick to the editor window", () => {
    const live = fakeLive();
    const w = load(live);
    vm.runInContext("onTick", w.ctx)(1, 12.5);
    expect(w.toReceivers).toContainEqual(["messnamed", "window-read-editor", "tick", 1, 12.5]);
  });

  it("points the device page and the editor window at a normal file URL on a Mac", () => {
    const live = fakeLive();
    const w = load(live);
    w.ctx.patcher.filepath = "Macintosh HD:/Users/me/Music/Ableton/User Library/Chord Fiend/chord-fiend-test.amxd";
    vm.runInContext("loadWebview()", w.ctx);
    const deviceUrl = w.toReceivers.find((r) => r[0] === "outlet" && r[2] === "url")[3];
    const windowUrl = w.toReceivers.find((r) => r[0] === "messnamed" && r[1] === "window-read-editor" && r[2] === "url")[3];
    expect(deviceUrl.split("?")[0]).toBe("file:///Users/me/Music/Ableton/User%20Library/Chord%20Fiend/chord-fiend-test.html");
    expect(windowUrl.split("?")[0]).toBe("file:///Users/me/Music/Ableton/User%20Library/Chord%20Fiend/chord-fiend-test_editor.html");
  });

  it("re-sends a page's URL until it says ui_ready, then stops", () => {
    const live = fakeLive();
    const w = load(live);
    w.ctx.patcher.filepath = "Macintosh HD:/Users/me/Lib/chord-fiend-test.amxd";
    vm.runInContext("loadWebview()", w.ctx);
    const urlsTo = (who) => w.toReceivers.filter((r) => (who === "device" ? r[0] === "outlet" && r[2] === "url" : r[1] === "window-read-editor" && r[2] === "url")).length;
    vm.runInContext("retryPages()", w.ctx);
    expect([urlsTo("device"), urlsTo("editor")]).toEqual([2, 2]);
    expect(w.toReceivers.filter((r) => r[0] === "outlet" && r[2] === "url").at(-1)[3]).toMatch(/&retry=1$/);
    vm.runInContext("ui_ready()", w.ctx); // the device page loaded
    w.send("ui_ready"); // ...and so did the window
    vm.runInContext("retryPages()", w.ctx);
    expect([urlsTo("device"), urlsTo("editor")]).toEqual([2, 2]);
  });
});
