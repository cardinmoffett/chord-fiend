// A fake Max and a fake Live set for running the built wrapper.js in Node.
//
// The fake is our belief about the Live API, taken from the Live Object Model docs, so
// passing against it does not prove Live behaves the same - that is what testing in Live is for.
// Run `pnpm build` first.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WRAPPER = path.join(here, "../dist/chord-fiend-test/wrapper.js");

export function fakeLive() {
  let nextId = 100;
  const objects = new Map();
  const add = (o) => {
    o.id = nextId++;
    objects.set(o.id, o);
    return o;
  };
  const song = add({ kind: "Song", is_playing: 0, current_song_time: 0, loop: 1, loop_start: 16, loop_length: 8, back_to_arranger: 1, tracks: [] });
  for (const [name, midi] of [["Chords", 1], ["Bass Line", 1], ["Drums", 1], ["Vox", 0]]) {
    song.tracks.push(add({ kind: "Track", name, has_midi_input: midi, arrangement_clips: [] }));
  }
  const calls = [];
  return { song, objects, calls, add };
}

export function loadWrapper(live) {
  const toReceivers = [];
  const posts = [];
  class LiveAPI {
    constructor(a, b) {
      const p = typeof a === "function" ? b : a;
      this.target = this.resolve(String(p));
    }
    resolve(p) {
      const parts = p.split(" ");
      if (parts[0] === "id") return live.objects.get(Number(parts[1])) || null;
      if (parts[0] === "live_set" && parts.length === 1) return live.song;
      if (parts[0] === "live_set" && parts[1] === "tracks") return live.song.tracks[Number(parts[2])] || null;
      if (parts[0] === "this_device") return null;
      return null;
    }
    get id() {
      return this.target ? String(this.target.id) : "0";
    }
    get type() {
      return this.target ? this.target.kind : "";
    }
    get unquotedpath() {
      return "id " + this.id;
    }
    getcount(child) {
      return this.target[child].length;
    }
    get(prop) {
      const v = this.target[prop];
      if (Array.isArray(v)) return v.flatMap((o) => ["id", o.id]);
      return [v];
    }
    set(prop, value) {
      live.calls.push(["set", this.target.kind, prop, value]);
      this.target[prop] = value;
    }
    call(method, ...args) {
      live.calls.push([method, this.target.kind, ...args]);
      const t = this.target;
      if (method === "create_midi_clip") {
        const [start, length] = args;
        const clip = live.add({ kind: "Clip", name: "", start_time: start, end_time: start + length, notes: [] });
        t.arrangement_clips.push(clip);
        return ["id", clip.id];
      }
      if (method === "delete_clip") {
        const id = Number(args[1]);
        t.arrangement_clips = t.arrangement_clips.filter((c) => c.id !== id);
        live.objects.delete(id);
        return;
      }
      if (method === "add_new_notes") {
        t.notes.push(...args[0].notes);
        return;
      }
      if (method === "remove_notes_extended") {
        const [fromPitch, span, fromTime, timeSpan] = args;
        t.notes = t.notes.filter((n) => !(n.pitch >= fromPitch && n.pitch < fromPitch + span && n.start_time >= fromTime && n.start_time < fromTime + timeSpan));
        return;
      }
      if (method === "start_playing") t.is_playing = 1;
      if (method === "stop_playing") t.is_playing = 0;
    }
  }
  class Task {
    cancel() {}
    repeat() {}
  }
  const ctx = {
    jsarguments: ["wrapper.js", "midi"],
    post: (s) => posts.push(String(s)),
    outlet: (...a) => toReceivers.push(["outlet", ...a]),
    messnamed: (...a) => toReceivers.push(["messnamed", ...a]),
    arrayfromargs: (a) => Array.prototype.slice.call(a),
    Task,
    LiveAPI,
    File: class {
      get isopen() {
        return false;
      }
    },
    Dict: class {},
    patcher: { filepath: "" },
    // The real build embeds these (with the pages) in the .amxd's copy of the wrapper;
    // dist/<device>/wrapper.js is the development copy without them.
    UI_PAYLOAD_NAME: "chord-fiend-test.html",
    EXTRA_PAYLOAD_NAMES: ["chord-fiend-test_editor.html"],
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(WRAPPER, "utf8"), ctx);
  const b64 = (o) => Buffer.from(JSON.stringify(o), "utf8").toString("base64");
  const fromB64 = (s) => JSON.parse(Buffer.from(String(s), "base64").toString("utf8"));
  const send = (selector, ...args) => vm.runInContext("window", ctx)("editor", selector, ...args);
  const replies = (sel) => toReceivers.filter((r) => r[0] === "messnamed" && r[1] === "window-read-editor" && r[2] === sel).map((r) => fromB64(r[3]));
  return { ctx, send, b64, replies, posts, toReceivers };
}

