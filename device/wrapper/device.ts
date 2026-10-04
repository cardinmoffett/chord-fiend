/**
 * device.ts - the Live side of the Chord Fiend feel test.
 *
 * Concatenated after the packaged wrapper into ONE [js] script, so it must compile to
 * ES5: var and function only, no console, no setTimeout (see the m4l-jweb CLAUDE.md).
 *
 * The editor window sends its requests here through onWindowMessage, and every reply
 * goes back to that window through reply(), which routes by replyWindow. Structured
 * payloads cross the bridge as base64 JSON, because Max splits messages on commas.
 *
 *   cf_tracks                      -> cf_tracks <b64 [{id, name, midi}]>
 *   cf_prune <b64 {role, trackId, keep:[{name, start, length}]}>
 *                                  -> cf_result <b64 {role, op:"prune", ok, deleted, error}>
 *   cf_write <b64 {role, name, trackId, start, length, color, notes:[[p,s,d,v]...]}>
 *                                  -> cf_result <b64 {role, name, ok, action, clipId, notes, error}>
 *   cf_clear <b64 {trackIds:[...]}> -> cf_result
 *
 * Our clips are named "Chord Fiend: <name>", where the window makes <name> unique per
 * track ("2 Chorus - bass"). A song write is one cf_prune per track, which deletes our
 * clips for that role that are no longer in the song, then a cf_write per clip that is new
 * or changed.
 *   cf_loop <start> <length> [jump] Live's loop on that range; with jump (default) playhead there, play
 *   cf_unloop                      the user's loop restored, playback continues
 *   cf_play <start>                playhead there, play (the user's loop restored)
 *   cf_stop                        stop, and restore the user's loop
 */

var CLIP_TAG = "Chord Fiend: ";
var EDITOR_WINDOW = "editor";

/* ---------------- base64 and UTF-8, both ways ---------------- */

var CF_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function cfUtf8Decode(bytes: number[]): string {
  var out = "";
  var i = 0;
  while (i < bytes.length) {
    var c = bytes[i++];
    if (c < 0x80) out += String.fromCharCode(c);
    else if (c < 0xe0) out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (c < 0xf0) {
      var c2 = bytes[i++];
      var c3 = bytes[i++];
      out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
    } else {
      var d2 = bytes[i++];
      var d3 = bytes[i++];
      var d4 = bytes[i++];
      var cp = (((c & 0x07) << 18) | ((d2 & 0x3f) << 12) | ((d3 & 0x3f) << 6) | (d4 & 0x3f)) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

function cfUtf8Encode(s: string): number[] {
  var out: number[] = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
      c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00);
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function cfB64Encode(bytes: number[]): string {
  var out = "";
  for (var i = 0; i < bytes.length; i += 3) {
    var n = (bytes[i] << 16) | ((i + 1 < bytes.length ? bytes[i + 1] : 0) << 8) | (i + 2 < bytes.length ? bytes[i + 2] : 0);
    out += CF_B64.charAt((n >> 18) & 63) + CF_B64.charAt((n >> 12) & 63);
    out += i + 1 < bytes.length ? CF_B64.charAt((n >> 6) & 63) : "=";
    out += i + 2 < bytes.length ? CF_B64.charAt(n & 63) : "=";
  }
  return out;
}

function cfDecode(b64: unknown): any {
  return JSON.parse(cfUtf8Decode(b64decode(String(b64))));
}

function cfReply(selector: string, value: unknown): void {
  reply(selector, cfB64Encode(cfUtf8Encode(JSON.stringify(value))));
}

/* ---------------- Live API helpers ---------------- */

/**
 * Is this a list? Not `instanceof Array`: that is false for an array made in another
 * JavaScript context, and we do not control which one LiveAPI's results come from.
 */
function cfIsList(v: unknown): v is any[] {
  return v !== null && typeof v === "object" && typeof (v as any).length === "number";
}

/** "id 5" / ["id", 5] / 5 -> 5; anything else -> 0. */
function cfIdOf(v: unknown): number {
  var a = cfIsList(v) ? v : String(v).split(" ");
  for (var i = 0; i < a.length; i++) {
    if (String(a[i]) === "id" && i + 1 < a.length) return Number(a[i + 1]);
  }
  var n = Number(a[a.length - 1]);
  return isNaN(n) ? 0 : n;
}

/** The ids in a LOM list property, which comes back as ["id", 1, "id", 2, ...]. */
function cfIdList(v: unknown): number[] {
  var a = cfIsList(v) ? v : String(v).split(" ");
  var out: number[] = [];
  for (var i = 0; i + 1 < a.length; i++) {
    if (String(a[i]) === "id") out.push(Number(a[i + 1]));
  }
  return out;
}

function cfGet(api: LiveAPI, prop: string): string {
  var v: any = api.get(prop);
  return cfIsList(v) ? v.join(" ") : String(v);
}

function cfNum(api: LiveAPI, prop: string): number {
  var v: any = api.get(prop);
  return Number(cfIsList(v) ? v[0] : v);
}

/** The clips this device placed on a track: Arrangement clips whose name carries the tag. */
function cfTaggedClips(track: LiveAPI): { id: number; start: number; end: number; name: string }[] {
  var ids = cfIdList(track.get("arrangement_clips"));
  var out: { id: number; start: number; end: number; name: string }[] = [];
  for (var i = 0; i < ids.length; i++) {
    var clip = new LiveAPI("id " + ids[i]);
    var name = cfGet(clip, "name");
    if (name.indexOf(CLIP_TAG) !== 0) continue;
    out.push({ id: ids[i], start: cfNum(clip, "start_time"), end: cfNum(clip, "end_time"), name: name });
  }
  return out;
}

function cfNotesDict(rows: number[][]): { notes: LiveNote[] } {
  var notes: LiveNote[] = [];
  for (var i = 0; i < rows.length; i++) {
    notes.push({ pitch: rows[i][0], start_time: rows[i][1], duration: rows[i][2], velocity: rows[i][3], mute: 0 });
  }
  return { notes: notes };
}

/* ---------------- requests from the editor window ---------------- */

function cf_tracks(): void {
  var song = new LiveAPI("live_set");
  var count = song.getcount("tracks");
  var tracks: { id: number; name: string; midi: boolean }[] = [];
  for (var i = 0; i < count; i++) {
    var t = new LiveAPI("live_set tracks " + i);
    tracks.push({ id: cfIdOf(t.id), name: cfGet(t, "name"), midi: cfNum(t, "has_midi_input") === 1 });
  }
  cfReply("cf_tracks", tracks);
}

/**
 * Put one role's notes on its track, as one Arrangement clip.
 *
 * If a clip of ours already covers exactly this range, its notes are replaced in place:
 * that is the path a rewrite during a loop takes, and the one the feel test is about.
 * Otherwise our old clips for this role on this track are deleted and a new clip is made.
 */
function cf_write(b64: unknown): void {
  var req: any;
  try {
    req = cfDecode(b64);
  } catch (e) {
    post("chord-fiend: cf_write could not read its request - " + (e as Error).message + "\n");
    return;
  }
  var result: any = { role: req.role, name: req.name, ok: false };
  var tag = CLIP_TAG + (req.name || req.role);
  try {
    var track = new LiveAPI("id " + req.trackId);
    if (!track.id || cfIdOf(track.id) === 0 || track.type !== "Track") throw new Error("track " + req.trackId + " not found");
    var start = Number(req.start);
    var length = Number(req.length);
    var mine = cfTaggedClips(track);
    var target: LiveAPI | null = null;

    for (var i = 0; i < mine.length; i++) {
      var c = mine[i];
      if (c.name === tag && Math.abs(c.start - start) < 0.001 && Math.abs(c.end - (start + length)) < 0.001) {
        target = new LiveAPI("id " + c.id);
        target.call("remove_notes_extended", 0, 128, 0, length + 1);
        result.action = "replaced";
        result.clipId = c.id;
        break;
      }
    }

    if (!target) {
      // A clip of ours with this name over a different range is stale: cf_prune normally
      // removes it first, but never leave two clips with one name.
      var deleted = 0;
      for (var j = 0; j < mine.length; j++) {
        if (mine[j].name !== tag) continue;
        track.call("delete_clip", "id", mine[j].id);
        deleted++;
      }
      var created: any = track.call("create_midi_clip", start, length);
      var clipId = cfIdOf(created);
      if (!clipId) {
        // Before Live 12.2 the call reportedly returns nothing; find the clip by its start.
        var all = cfIdList(track.get("arrangement_clips"));
        for (var k = 0; k < all.length; k++) {
          var probe = new LiveAPI("id " + all[k]);
          if (Math.abs(cfNum(probe, "start_time") - start) < 0.001 && cfGet(probe, "name").indexOf(CLIP_TAG) !== 0) clipId = all[k];
        }
      }
      if (!clipId) throw new Error("create_midi_clip made no clip at beat " + start);
      target = new LiveAPI("id " + clipId);
      target.set("name", tag);
      result.action = deleted ? "recreated" : "created";
      result.deleted = deleted;
      result.clipId = clipId;
    }

    // Live snaps an RGB colour to the nearest one in its clip palette.
    if (req.color !== undefined && req.color !== null) target.set("color", Number(req.color));
    if (req.notes.length) target.call("add_new_notes", cfNotesDict(req.notes));
    result.notes = req.notes.length;
    result.ok = true;
  } catch (e2) {
    result.error = (e2 as Error).message;
  }
  post("chord-fiend: write " + tag + " -> " + (result.ok ? result.action + " clip " + result.clipId + ", " + result.notes + " notes" : "FAILED " + result.error) + "\n");
  cfReply("cf_result", result);
}

/**
 * Delete our clips for one role on one track that are not in `keep` (same name and range).
 * Runs before the writes, so a new layout never creates a clip on top of a stale one.
 */
function cf_prune(b64: unknown): void {
  var req = cfDecode(b64);
  var result: any = { role: req.role, op: "prune", ok: false, deleted: 0 };
  try {
    var track = new LiveAPI("id " + req.trackId);
    if (!track.id || cfIdOf(track.id) === 0 || track.type !== "Track") throw new Error("track " + req.trackId + " not found");
    var suffix = " - " + req.role;
    var mine = cfTaggedClips(track);
    for (var i = 0; i < mine.length; i++) {
      var c = mine[i];
      // Ours for this role: "<name> - <role>", or the first feel test's plain "<role>".
      var forRole = c.name.slice(-suffix.length) === suffix || c.name === CLIP_TAG + req.role;
      if (!forRole) continue;
      var kept = false;
      for (var k = 0; k < req.keep.length; k++) {
        var want = req.keep[k];
        if (c.name === CLIP_TAG + want.name && Math.abs(c.start - want.start) < 0.001 && Math.abs(c.end - (want.start + want.length)) < 0.001) kept = true;
      }
      if (kept) continue;
      track.call("delete_clip", "id", c.id);
      result.deleted++;
    }
    result.ok = true;
  } catch (e) {
    result.error = (e as Error).message;
  }
  post("chord-fiend: prune " + req.role + " -> " + (result.ok ? "deleted " + result.deleted : "FAILED " + result.error) + "\n");
  cfReply("cf_result", result);
}

/** Delete every clip this device placed on the given tracks. */
function cf_clear(b64: unknown): void {
  var req = cfDecode(b64);
  var deleted = 0;
  var error: string | null = null;
  try {
    for (var i = 0; i < req.trackIds.length; i++) {
      var track = new LiveAPI("id " + req.trackIds[i]);
      if (!track.id || cfIdOf(track.id) === 0) continue;
      var mine = cfTaggedClips(track);
      for (var j = 0; j < mine.length; j++) {
        track.call("delete_clip", "id", mine[j].id);
        deleted++;
      }
    }
  } catch (e) {
    error = (e as Error).message;
  }
  post("chord-fiend: cleared " + deleted + " clips" + (error ? " (error: " + error + ")" : "") + "\n");
  cfReply("cf_result", { role: "clear", ok: !error, deleted: deleted, error: error });
}

/* ---------------- transport ---------------- */

/** The user's own loop, saved before our first preview and put back on stop. */
var savedLoop: { on: number; start: number; length: number } | null = null;

function cfSaveUserLoop(song: LiveAPI): void {
  if (savedLoop) return;
  savedLoop = { on: cfNum(song, "loop"), start: cfNum(song, "loop_start"), length: cfNum(song, "loop_length") };
}

function cfRestoreUserLoop(song: LiveAPI): void {
  if (!savedLoop) return;
  song.set("loop_start", savedLoop.start);
  song.set("loop_length", savedLoop.length);
  song.set("loop", savedLoop.on);
  savedLoop = null;
}

/**
 * Loop a range. `jump` 1 (the default) moves the playhead there and plays; 0 only moves
 * the loop, for when an edit shifts the range of something that is already looping.
 */
function cf_loop(start: number, length: number, jump?: number): void {
  var song = new LiveAPI("live_set");
  cfSaveUserLoop(song);
  song.set("loop_start", Number(start));
  song.set("loop_length", Number(length));
  song.set("loop", 1);
  if (jump === 0) return;
  song.set("back_to_arranger", 0);
  song.set("current_song_time", Number(start));
  if (cfNum(song, "is_playing") !== 1) song.call("start_playing");
  post("chord-fiend: loop " + start + " + " + length + " beats\n");
}

function cf_play(start: number): void {
  var song = new LiveAPI("live_set");
  cfRestoreUserLoop(song);
  song.set("back_to_arranger", 0);
  song.set("current_song_time", Number(start));
  if (cfNum(song, "is_playing") !== 1) song.call("start_playing");
}

/** Stop looping and put the user's loop back, without stopping playback. */
function cf_unloop(): void {
  cfRestoreUserLoop(new LiveAPI("live_set"));
}

function cf_stop(): void {
  var song = new LiveAPI("live_set");
  song.call("stop_playing");
  cfRestoreUserLoop(song);
}

/* ---------------- hooks into the packaged wrapper ---------------- */

function onWindowMessage(windowId: string, selector: string, a1?: unknown, a2?: unknown, a3?: unknown): void {
  try {
    if (selector === "cf_tracks") cf_tracks();
    else if (selector === "cf_write") cf_write(a1);
    else if (selector === "cf_prune") cf_prune(a1);
    else if (selector === "cf_clear") cf_clear(a1);
    else if (selector === "cf_loop") cf_loop(Number(a1), Number(a2), a3 === undefined ? 1 : Number(a3));
    else if (selector === "cf_unloop") cf_unloop();
    else if (selector === "cf_play") cf_play(Number(a1));
    else if (selector === "cf_stop") cf_stop();
    else post("chord-fiend: window " + windowId + " sent unhandled '" + selector + "'\n");
  } catch (e) {
    post("chord-fiend: " + selector + " failed - " + (e as Error).message + "\n");
  }
}

/** The transport poll only reaches the device's own page; the editor window needs it too. */
function onTick(playing: number, beats: number): void {
  messnamed("window-read-" + EDITOR_WINDOW, "tick", playing, beats);
}
