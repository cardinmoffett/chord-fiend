import { useEffect, useMemo, useRef, useState } from "react";
import { bindInlet, decodeBase64, encodeBase64, outlet } from "@m4l-jweb/bridge";
import { useStateSync } from "@m4l-jweb/surface/react";
import {
  BLOCK_MODE_NAMES,
  BUILTIN_BEAT_PATTERNS,
  DURATION_NAMES,
  EXTENSION_NAMES,
  MASTER_MODE_NAMES,
  buildChord,
  beatPatternLabel,
  defaultBlock,
  degreeLabels,
  getChordSymbol,
  noteChoiceLabel,
  pitchToFullNoteName,
} from "../../../../engine/src/engine.js";
import { useDevice } from "../shared/device";
import { IN, OUT } from "./protocol";
import surface from "./surface";
import {
  BEATS_PER_BAR,
  ROLES,
  blockLength,
  editingBlocks,
  findSection,
  layoutSong,
  normalizeSong,
  planSongWrite,
  withEditingBlocks,
  type Block,
  type PlacedSlot,
  type Slot,
  type Song,
  type TrackRef,
} from "./song";

interface LiveTrack {
  id: number;
  name: string;
  midi: boolean;
}

function send(selector: string, value: unknown) {
  outlet(selector, encodeBase64(JSON.stringify(value)));
}

const bar = (beats: number) => Math.floor(beats / BEATS_PER_BAR) + 1;
const sectionColor = (id: number, light = false) => `hsl(${(id * 67) % 360} 45% ${light ? 42 : 30}%)`;
const PX_PER_BEAT = 12;

/** The editor window. The window owns the song; the Arrangement is its output. */
export default function Editor() {
  const device = useDevice();
  const [stored, setStored] = useStateSync(surface, "song");
  const song = normalizeSong(stored);
  const [tracks, setTracks] = useState<LiveTrack[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [paste, setPaste] = useState("");

  const songRef = useRef(song);
  songRef.current = song;
  const save = (next: Song) => setStored(next);
  const update = (change: Partial<Song>) => save({ ...songRef.current, ...change });
  const say = (line: string) => setLog((l) => [new Date().toLocaleTimeString() + "  " + line, ...l].slice(0, 14));

  // What was last sent for each clip ("<trackId>|<name>"), so an edit rewrites only the clips it changed.
  const lastSent = useRef(new Map<string, string>());
  // Rewrite on edit only once the song is on the Arrangement: after a Write, or in a Set that already has tracks chosen.
  const [written, setWritten] = useState(() => ROLES.some((r) => song.tracks[r]));

  useEffect(() => {
    bindInlet(IN.cf_tracks, (b64) => setTracks(JSON.parse(decodeBase64(String(b64)))));
    bindInlet(IN.cf_result, (b64) => {
      const r = JSON.parse(decodeBase64(String(b64)));
      if (r.role === "clear") say(r.ok ? `removed ${r.deleted} clips` : `remove FAILED: ${r.error}`);
      else if (r.op === "prune") {
        if (!r.ok) say(`${r.role}: tidy-up FAILED - ${r.error}`);
        else if (r.deleted) say(`${r.role}: removed ${r.deleted} old clip(s)`);
      } else say(r.ok ? `${r.name}: ${r.action}, ${r.notes} notes` : `${r.name}: FAILED - ${r.error}`);
    });
    outlet(OUT.cf_tracks);
  }, []);

  // Track ids are not stable across reopening a Set, so a saved choice is found again by name.
  useEffect(() => {
    if (!tracks.length) return;
    const next = { ...songRef.current.tracks };
    let changed = false;
    for (const role of ROLES) {
      const ref = next[role];
      if (!ref || tracks.some((t) => t.id === ref.id && t.name === ref.name)) continue;
      const byName = tracks.find((t) => t.name === ref.name);
      next[role] = byName ? { id: byName.id, name: byName.name } : null;
      changed = true;
    }
    if (changed) update({ tracks: next });
  }, [tracks]);

  const placed = useMemo(() => layoutSong(song), [song]);
  const songStart = (Math.max(1, song.startBar) - 1) * BEATS_PER_BAR;
  const songEnd = placed.length ? placed[placed.length - 1].start + placed[placed.length - 1].length : songStart;

  function writeSong(everything: boolean) {
    const s = songRef.current;
    if (!ROLES.some((r) => s.tracks[r])) {
      say("pick at least one track first");
      return;
    }
    const plan = planSongWrite(s, lastSent.current, everything);
    for (const [selector, payload] of plan.messages) send(selector, payload);
    setWritten(true);
    say(`song: ${plan.sent} clip(s) written${plan.same ? `, ${plan.same} unchanged` : ""} (bars ${bar(songStart)}-${bar(songEnd - 0.001)})`);
  }

  // Rewrite on every edit: only the clips the edit changed, plus removing clips no longer in the song.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!song.autoWrite || !written) return;
    const t = setTimeout(() => writeSong(false), 120);
    return () => clearTimeout(t);
  }, [placed]);

  function removeOurClips() {
    const ids = ROLES.map((r) => song.tracks[r]?.id).filter((x): x is number => !!x);
    send(OUT.cf_clear, { trackIds: ids });
    lastSent.current.clear();
    setWritten(false);
  }

  /* ---------------- song order and sections ---------------- */

  const newId = () => songRef.current.nextId;
  function addSlot(sectionId: number) {
    const s = songRef.current;
    save({ ...s, slots: [...s.slots, { id: s.nextId, sectionId, blocks: null }], nextId: s.nextId + 1 });
  }
  function moveSlot(i: number, dir: -1 | 1) {
    const slots = [...song.slots];
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    [slots[i], slots[j]] = [slots[j], slots[i]];
    update({ slots });
  }
  function removeSlot(id: number) {
    if (song.slots.length < 2) return;
    const slots = song.slots.filter((x) => x.id !== id);
    const editing = song.editing.kind === "slot" && song.editing.id === id ? { kind: "section" as const, id: song.slots.find((x) => x.id === id)!.sectionId } : song.editing;
    update({ slots, editing });
  }
  function editSlot(slot: Slot) {
    update({ editing: slot.blocks ? { kind: "slot", id: slot.id } : { kind: "section", id: slot.sectionId } });
  }
  function detachSlot(slot: Slot) {
    const blocks = (findSection(song, slot.sectionId)?.blocks ?? []).map((b) => ({ ...b }));
    update({ slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks } : x)), editing: { kind: "slot", id: slot.id } });
  }
  function relinkSlot(slot: Slot) {
    update({ slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks: null } : x)), editing: { kind: "section", id: slot.sectionId } });
  }
  function newSection() {
    const s = songRef.current;
    const id = s.nextId;
    save({ ...s, sections: [...s.sections, { id, name: `Section ${s.sections.length + 1}`, blocks: [defaultBlock()] }], nextId: id + 1, editing: { kind: "section", id } });
  }
  function duplicateSection(id: number) {
    const src = findSection(song, id);
    if (!src) return;
    const nid = newId();
    update({ sections: [...song.sections, { id: nid, name: src.name + " copy", blocks: src.blocks.map((b) => ({ ...b })) }], nextId: nid + 1, editing: { kind: "section", id: nid } });
  }
  function deleteSection(id: number) {
    if (song.sections.length < 2) return;
    const sections = song.sections.filter((x) => x.id !== id);
    let slots = song.slots.filter((x) => x.sectionId !== id);
    if (!slots.length) slots = [{ id: song.nextId, sectionId: sections[0].id, blocks: null }];
    update({ sections, slots, nextId: song.nextId + 1, editing: { kind: "section", id: sections[0].id } });
  }
  function renameSection(id: number, name: string) {
    update({ sections: song.sections.map((x) => (x.id === id ? { ...x, name } : x)) });
  }

  /* ---------------- the blocks being edited ---------------- */

  const blocks = editingBlocks(song);
  const editingSection = song.editing.kind === "section" ? findSection(song, song.editing.id) : undefined;
  const editingSlot = song.editing.kind === "slot" ? song.slots.find((x) => x.id === song.editing.id) : undefined;
  const editingSlotPlaced = editingSlot ? placed.find((p) => p.slot.id === editingSlot.id) : undefined;
  const usesOfSection = editingSection ? placed.filter((p) => !p.slot.blocks && p.slot.sectionId === editingSection.id) : [];
  // Where a block's Loop goes: the slot being edited, or the first place this section is used.
  const loopTarget: PlacedSlot | undefined = editingSlotPlaced ?? usesOfSection[0];
  const setBlocks = (next: Block[]) => save(withEditingBlocks(songRef.current, next));
  const setBlock = (i: number, change: Partial<Block>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...change } : b)));

  const playingSlot = device.playing ? placed.find((p) => device.beats >= p.start && device.beats < p.start + p.length) : undefined;
  const showsPlayingSlot =
    playingSlot && (editingSlot ? playingSlot.slot.id === editingSlot.id : !playingSlot.slot.blocks && playingSlot.slot.sectionId === editingSection?.id);
  const playingBlock = showsPlayingSlot
    ? playingSlot!.blockStarts.findIndex((s, i) => device.beats >= playingSlot!.start + s && device.beats < playingSlot!.start + s + blockLength(playingSlot!.blocks[i]))
    : -1;
  const homeLabels = degreeLabels(MASTER_MODE_NAMES[song.modeIndex]);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#ddd", background: "#1e1e1e", minHeight: "100vh", boxSizing: "border-box" }}>
      <header style={row}>
        <strong style={{ fontSize: 16, marginRight: 8 }}>Chord Fiend - feel test</strong>
        <Pick inline label="Key" value={song.rootIndex} options={Array.from({ length: 12 }, (_, i) => noteChoiceLabel(i))} onChange={(v) => update({ rootIndex: v })} />
        <Pick inline label="Mode" value={song.modeIndex} options={MASTER_MODE_NAMES} onChange={(v) => update({ modeIndex: v })} />
        <label>
          Beat{" "}
          <select value={song.drumBeat} onChange={(e) => update({ drumBeat: e.target.value })}>
            {Object.keys(BUILTIN_BEAT_PATTERNS).map((k) => (
              <option key={k} value={k}>
                {beatPatternLabel(k)}
              </option>
            ))}
            <option value="off">Off</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={song.bassEnabled} onChange={(e) => update({ bassEnabled: e.target.checked })} /> Bass
        </label>
        <label>
          Bass lowest note{" "}
          <select value={song.bassWrapLow} onChange={(e) => update({ bassWrapLow: Number(e.target.value) })}>
            {Array.from({ length: 25 }, (_, i) => 24 + i).map((p) => (
              <option key={p} value={p}>
                {pitchToFullNoteName(p)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Song starts at bar{" "}
          <input type="number" min={1} value={song.startBar} style={{ width: 56 }} onChange={(e) => update({ startBar: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
      </header>

      <section style={row}>
        {ROLES.map((role) => (
          <label key={role}>
            {role[0].toUpperCase() + role.slice(1)} track{" "}
            <select
              value={song.tracks[role]?.id ?? ""}
              onChange={(e) => {
                const t = tracks.find((x) => x.id === Number(e.target.value));
                update({ tracks: { ...song.tracks, [role]: t ? ({ id: t.id, name: t.name } as TrackRef) : null } });
              }}
            >
              <option value="">(none)</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.midi}>
                  {t.name}
                  {t.midi ? "" : " (audio)"}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button onClick={() => outlet(OUT.cf_tracks)}>Refresh tracks</button>
      </section>

      <h3 style={h3}>Song</h3>
      <section style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 6, marginBottom: 8, alignItems: "stretch" }}>
        {placed.map((p, i) => {
          const isEditing = editingSlot ? editingSlot.id === p.slot.id : !p.slot.blocks && editingSection?.id === p.slot.sectionId;
          const isPlaying = playingSlot?.slot.id === p.slot.id;
          return (
            <div
              key={p.slot.id}
              onClick={() => editSlot(p.slot)}
              style={{
                minWidth: Math.max(130, p.length * PX_PER_BEAT),
                padding: 8,
                borderRadius: 6,
                cursor: "pointer",
                background: sectionColor(p.slot.sectionId, isPlaying),
                border: isEditing ? "2px solid #fff" : "2px solid transparent",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {i + 1}. {p.label}
              </div>
              <div style={{ opacity: 0.8, marginBottom: 6 }}>
                bars {bar(p.start)}-{bar(p.start + p.length - 0.001)}
              </div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                <button title="Move earlier" disabled={i === 0} onClick={() => moveSlot(i, -1)}>
                  ◀
                </button>
                <button title="Move later" disabled={i === placed.length - 1} onClick={() => moveSlot(i, 1)}>
                  ▶
                </button>
                <button onClick={() => outlet(OUT.cf_loop, p.start, p.length)}>Loop</button>
                {p.slot.blocks ? <button onClick={() => relinkSlot(p.slot)}>Relink</button> : <button onClick={() => detachSlot(p.slot)}>Detach</button>}
                <button title="Remove from the song" disabled={placed.length < 2} onClick={() => removeSlot(p.slot.id)}>
                  ✕
                </button>
              </div>
            </div>
          );
        })}
        <select value="" onChange={(e) => e.target.value && addSlot(Number(e.target.value))} style={{ alignSelf: "center" }}>
          <option value="">+ Add to song...</option>
          {song.sections.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </section>

      <h3 style={h3}>Sections</h3>
      <section style={row}>
        {song.sections.map((x) => (
          <button
            key={x.id}
            onClick={() => update({ editing: { kind: "section", id: x.id } })}
            style={{ background: sectionColor(x.id), color: "#fff", border: editingSection?.id === x.id ? "2px solid #fff" : "2px solid transparent", borderRadius: 6, padding: "4px 10px" }}
          >
            {x.name}
          </button>
        ))}
        <button onClick={newSection}>+ New section</button>
      </section>

      <section style={{ ...row, background: "#262626", padding: 8, borderRadius: 6 }}>
        {editingSection ? (
          <>
            <span>Editing section</span>
            <input value={editingSection.name} onChange={(e) => renameSection(editingSection.id, e.target.value)} style={{ width: 140 }} />
            <span style={{ opacity: 0.7 }}>
              {usesOfSection.length === 0
                ? "not in the song yet - add it above"
                : usesOfSection.length === 1
                  ? "used once in the song"
                  : `used ${usesOfSection.length} times - changes apply to all of them`}
            </span>
            <button onClick={() => duplicateSection(editingSection.id)}>Duplicate</button>
            <button disabled={song.sections.length < 2} onClick={() => deleteSection(editingSection.id)}>
              Delete section
            </button>
          </>
        ) : editingSlot ? (
          <>
            <span>
              Editing song part {placed.findIndex((p) => p.slot.id === editingSlot.id) + 1}, a detached copy of {findSection(song, editingSlot.sectionId)?.name}: changes apply here only
            </span>
            <button onClick={() => relinkSlot(editingSlot)}>Relink to the section</button>
          </>
        ) : null}
      </section>

      <section style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {blocks.map((b, i) => {
          const chord = buildChord(b, song.rootIndex, song.modeIndex);
          const active = i === playingBlock;
          return (
            <div key={i} style={{ width: 170, padding: 10, borderRadius: 8, background: active ? "#3d6b4f" : "#2c2c2c", border: active ? "2px solid #7fd19b" : "2px solid #3a3a3a" }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{getChordSymbol(chord, song.rootIndex)}</div>
              <Pick label="Degree" value={b.degreeIndex} options={homeLabels} onChange={(v) => setBlock(i, { degreeIndex: v })} />
              <Pick label="Mode" value={b.blockModeIndex} options={BLOCK_MODE_NAMES} onChange={(v) => setBlock(i, { blockModeIndex: v })} />
              <Pick label="Ext" value={b.extensionIndex} options={EXTENSION_NAMES} onChange={(v) => setBlock(i, { extensionIndex: v })} />
              <Pick label="Inversion" value={chord.inversion} options={chord.toneLabels} onChange={(v) => setBlock(i, { inversion: v })} />
              <Pick label="Length" value={b.durationIndex} options={DURATION_NAMES} onChange={(v) => setBlock(i, { durationIndex: v })} />
              <label style={{ display: "block", margin: "4px 0" }}>
                <input type="checkbox" checked={b.bassToneIndex !== -1} onChange={(e) => setBlock(i, { bassToneIndex: e.target.checked ? 0 : -1 })} /> Bass
              </label>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  disabled={!loopTarget}
                  title={loopTarget ? `Loops this chord in song part ${loopTarget.index + 1}` : "Add this section to the song to loop it"}
                  onClick={() => loopTarget && outlet(OUT.cf_loop, loopTarget.start + loopTarget.blockStarts[i], blockLength(b))}
                >
                  Loop
                </button>
                <button disabled={blocks.length < 2} onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button style={{ width: 80 }} onClick={() => setBlocks([...blocks, defaultBlock()])}>
          + Block
        </button>
      </section>

      <section style={{ ...row, marginBottom: 12 }}>
        <button onClick={() => writeSong(true)} style={{ padding: "6px 12px", fontWeight: 600 }}>
          Write song to Arrangement
        </button>
        <label>
          <input type="checkbox" checked={song.autoWrite} onChange={(e) => update({ autoWrite: e.target.checked })} /> Rewrite on every edit
        </label>
        <button onClick={removeOurClips}>Remove our clips</button>
        <span style={{ width: 16 }} />
        <button onClick={() => outlet(OUT.cf_loop, songStart, songEnd - songStart)}>Loop song</button>
        <button onClick={() => outlet(OUT.cf_play, songStart)}>Play from start</button>
        <button onClick={() => outlet(OUT.cf_stop)}>Stop</button>
        <span style={{ opacity: 0.7 }}>
          {device.playing ? "playing" : "stopped"} at bar {bar(device.beats)}
          {playingSlot ? ` (song part ${playingSlot.index + 1}, ${playingSlot.label})` : ""}
        </span>
      </section>

      <section style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 2 }}>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Log</div>
          <pre style={{ margin: 0, padding: 8, background: "#151515", borderRadius: 6, minHeight: 120, whiteSpace: "pre-wrap" }}>{log.join("\n") || "-"}</pre>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Paste test: paste any text here</div>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} style={{ width: "100%", height: 120, boxSizing: "border-box" }} />
          <div style={{ opacity: 0.7 }}>{paste.length} characters</div>
        </div>
      </section>
    </main>
  );
}

const row = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, marginBottom: 10 };
const h3 = { margin: "8px 0 6px", fontSize: 13, textTransform: "uppercase" as const, letterSpacing: 1, opacity: 0.7 };

function Pick({ label, value, options, onChange, inline }: { label: string; value: number; options: readonly string[]; onChange: (v: number) => void; inline?: boolean }) {
  return (
    <label style={{ display: inline ? "inline-block" : "block", margin: "3px 0" }}>
      <span style={{ display: "inline-block", minWidth: inline ? 0 : 64, marginRight: 4, opacity: 0.7 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o, i) => (
          <option key={i} value={i}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
