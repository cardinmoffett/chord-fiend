import { useEffect, useMemo, useRef, useState } from "react";
import { bindInlet, decodeBase64, encodeBase64, outlet } from "@m4l-jweb/bridge";
import { useStateSync } from "@m4l-jweb/surface/react";
import { BUILTIN_BEAT_PATTERNS, MASTER_MODE_NAMES, beatPatternLabel, defaultBlock, noteChoiceLabel, pitchToFullNoteName } from "../../../../engine/src/engine.js";
import { useDevice } from "../shared/device";
import { Inspector } from "./Inspector";
import { IN, OUT } from "./protocol";
import surface from "./surface";
import {
  BEATS_PER_BAR,
  ROLES,
  blockColor,
  blockLabel,
  blockLength,
  editingBlocks,
  findSection,
  layoutSong,
  normalizeSong,
  planSongWrite,
  sectionColor,
  withEditingBlocks,
  type Block,
  type PlacedSlot,
  type Slot,
  type Song,
  type TrackRef,
} from "./song";
import "./editor.css";

interface LiveTrack {
  id: number;
  name: string;
  midi: boolean;
}

/** What the transport's Loop is holding: a chord in a song part, a song part, or the whole song. */
type LoopTarget = { kind: "block"; slotId: number; blockIndex: number } | { kind: "slot"; slotId: number } | { kind: "song" };

const BEATS_PER_ROW = 4 * BEATS_PER_BAR;
const send = (selector: string, value: unknown) => outlet(selector, encodeBase64(JSON.stringify(value)));
const barBeat = (beats: number) => `Bar ${Math.floor(beats / BEATS_PER_BAR) + 1} · ${Math.floor(beats % BEATS_PER_BAR) + 1}`;
const bars = (p: PlacedSlot) => `bars ${p.start / BEATS_PER_BAR + 1}-${Math.ceil((p.start + p.length) / BEATS_PER_BAR)}`;

/** The editor window. The window owns the song; the Arrangement follows it automatically. */
export default function Editor() {
  const device = useDevice();
  const [stored, setStored] = useStateSync(surface, "song");
  const song = normalizeSong(stored);
  const songRef = useRef(song);
  songRef.current = song;
  const save = (next: Song) => setStored(next);
  const update = (change: Partial<Song>) => save({ ...songRef.current, ...change });

  const [view, setView] = useState<"song" | "section">("song");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [picker, setPicker] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loop, setLoop] = useState<LoopTarget | null>(null);
  const [tracks, setTracks] = useState<LiveTrack[] | null>(null);
  const [activity, setActivity] = useState<string[]>([]);
  const [synced, setSynced] = useState<string | null>(null);
  const say = (line: string) => setActivity((l) => [new Date().toLocaleTimeString() + "  " + line, ...l].slice(0, 30));

  /* ---------------- Live: tracks and results ---------------- */

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
    if (!tracks) return;
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

  /* ---------------- the Arrangement follows the song ---------------- */

  const placed = useMemo(() => layoutSong(song), [song]);
  const songLength = placed.length ? placed[placed.length - 1].start + placed[placed.length - 1].length : 0;
  const hasTracks = ROLES.some((r) => song.tracks[r]);
  const lastSent = useRef(new Map<string, string>());

  // Every change is written, and only the clips it changed. The first write after the window
  // opens sends everything, so the Arrangement always matches the song. It waits for the track
  // list, because track ids saved in the Set may have changed.
  useEffect(() => {
    if (!tracks || !hasTracks) return;
    const t = setTimeout(() => {
      const plan = planSongWrite(songRef.current, lastSent.current, false);
      for (const [selector, payload] of plan.messages) send(selector, payload);
      if (plan.sent) say(`song: ${plan.sent} clip(s) written, ${plan.same} unchanged`);
      setSynced(new Date().toLocaleTimeString());
    }, 150);
    return () => clearTimeout(t);
  }, [placed, tracks, song.tracks]);

  /* ---------------- what is being edited ---------------- */

  const editingSection = song.editing.kind === "section" ? findSection(song, song.editing.id) : undefined;
  const editingSlot = song.editing.kind === "slot" ? song.slots.find((x) => x.id === song.editing.id) : undefined;
  const blocks = editingBlocks(song);
  const usesOfSection = editingSection ? placed.filter((p) => !p.slot.blocks && p.slot.sectionId === editingSection.id) : [];
  // Where the section being edited is heard: the detached part being edited, or the first place the section is used.
  const hearing: PlacedSlot | undefined = editingSlot ? placed.find((p) => p.slot.id === editingSlot.id) : usesOfSection[0];
  const block = selectedBlock !== null ? blocks[selectedBlock] : undefined;

  function openEditor(slot: Slot | null, sectionId?: number) {
    if (slot) update({ editing: slot.blocks ? { kind: "slot", id: slot.id } : { kind: "section", id: slot.sectionId } });
    else if (sectionId) update({ editing: { kind: "section", id: sectionId } });
    setSelectedBlock(0);
    setView("section");
  }

  /* ---------------- transport ---------------- */

  function rangeOf(target: LoopTarget | null): { start: number; length: number; label: string } | null {
    if (!target) return null;
    if (target.kind === "song") return songLength ? { start: 0, length: songLength, label: "Whole song" } : null;
    const p = placed.find((x) => x.slot.id === target.slotId);
    if (!p) return null;
    if (target.kind === "slot") return { start: p.start, length: p.length, label: `${p.index + 1} ${p.label}` };
    const b = p.blocks[target.blockIndex];
    if (!b) return null;
    return { start: p.start + p.blockStarts[target.blockIndex], length: blockLength(b), label: `${p.index + 1} ${p.label} · chord ${target.blockIndex + 1}` };
  }

  function selectionTarget(): LoopTarget | null {
    if (view === "section") {
      if (!hearing) return null;
      return selectedBlock !== null && selectedBlock < hearing.blocks.length ? { kind: "block", slotId: hearing.slot.id, blockIndex: selectedBlock } : { kind: "slot", slotId: hearing.slot.id };
    }
    return selectedSlotId !== null ? { kind: "slot", slotId: selectedSlotId } : { kind: "song" };
  }

  const loopRange = rangeOf(loop);
  const selection = selectionTarget();
  const selectionDiffers = loop && JSON.stringify(selection) !== JSON.stringify(loop);

  // A loop whose target is gone ends; one whose range moved (an edit made a chord longer) follows it.
  const sentLoop = useRef("");
  useEffect(() => {
    if (!loop) {
      sentLoop.current = "";
      return;
    }
    if (!loopRange) {
      outlet(OUT.cf_unloop);
      setLoop(null);
      return;
    }
    const key = `${loopRange.start}|${loopRange.length}`;
    if (sentLoop.current && sentLoop.current !== key) outlet(OUT.cf_loop, loopRange.start, loopRange.length, 0);
    sentLoop.current = key;
  }, [loop, loopRange?.start, loopRange?.length]);

  function startLoop(target: LoopTarget | null) {
    const r = rangeOf(target);
    if (!target || !r) return;
    sentLoop.current = `${r.start}|${r.length}`;
    setLoop(target);
    outlet(OUT.cf_loop, r.start, r.length, 1);
  }
  function toggleLoop() {
    if (loop) {
      outlet(OUT.cf_unloop);
      setLoop(null);
    } else startLoop(selection);
  }
  function play() {
    if (loopRange) return outlet(OUT.cf_loop, loopRange.start, loopRange.length, 1);
    const from = view === "section" ? (hearing?.start ?? 0) : (placed.find((p) => p.slot.id === selectedSlotId)?.start ?? 0);
    outlet(OUT.cf_play, from);
  }
  function stop() {
    outlet(OUT.cf_stop);
    setLoop(null);
  }

  const playingSlot = device.playing ? placed.find((p) => device.beats >= p.start && device.beats < p.start + p.length) : undefined;
  const playingHere = playingSlot && (editingSlot ? playingSlot.slot.id === editingSlot.id : !playingSlot.slot.blocks && playingSlot.slot.sectionId === editingSection?.id);
  const playingBlock = playingHere
    ? playingSlot!.blockStarts.findIndex((s, i) => device.beats >= playingSlot!.start + s && device.beats < playingSlot!.start + s + blockLength(playingSlot!.blocks[i]))
    : -1;

  /* ---------------- song order and sections ---------------- */

  function insertSlot(sectionId: number) {
    const s = songRef.current;
    const slot: Slot = { id: s.nextId, sectionId, blocks: null };
    const at = selectedSlotId !== null ? s.slots.findIndex((x) => x.id === selectedSlotId) + 1 : s.slots.length;
    const slots = [...s.slots.slice(0, at), slot, ...s.slots.slice(at)];
    save({ ...s, slots, nextId: s.nextId + 1 });
    setSelectedSlotId(slot.id);
    setPicker(false);
  }
  function moveSlot(id: number, dir: -1 | 1) {
    const i = song.slots.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= song.slots.length) return;
    const slots = [...song.slots];
    [slots[i], slots[j]] = [slots[j], slots[i]];
    update({ slots });
  }
  function removeSlot(id: number) {
    if (song.slots.length < 2) return;
    const slot = song.slots.find((x) => x.id === id)!;
    const editing = song.editing.kind === "slot" && song.editing.id === id ? { kind: "section" as const, id: slot.sectionId } : song.editing;
    update({ slots: song.slots.filter((x) => x.id !== id), editing });
    setSelectedSlotId(null);
  }
  function detachSlot(slot: Slot) {
    const copy = (findSection(song, slot.sectionId)?.blocks ?? []).map((b) => ({ ...b }));
    update({ slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks: copy } : x)), editing: song.editing.kind === "section" ? song.editing : { kind: "slot", id: slot.id } });
  }
  function relinkSlot(slot: Slot) {
    update({ slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks: null } : x)), editing: song.editing.kind === "slot" && song.editing.id === slot.id ? { kind: "section", id: slot.sectionId } : song.editing });
  }
  function newSection() {
    const s = songRef.current;
    const id = s.nextId;
    save({ ...s, sections: [...s.sections, { id, name: `Section ${s.sections.length + 1}`, blocks: [defaultBlock()] }], nextId: id + 1, editing: { kind: "section", id } });
    setSelectedBlock(0);
    setView("section");
  }
  function duplicateSection(id: number) {
    const src = findSection(song, id);
    if (!src) return;
    const nid = song.nextId;
    update({ sections: [...song.sections, { id: nid, name: src.name + " copy", blocks: src.blocks.map((b) => ({ ...b })) }], nextId: nid + 1, editing: { kind: "section", id: nid } });
  }
  function deleteSection(id: number) {
    if (song.sections.length < 2) return;
    const sections = song.sections.filter((x) => x.id !== id);
    let slots = song.slots.filter((x) => x.sectionId !== id);
    let nextId = song.nextId;
    if (!slots.length) slots = [{ id: nextId++, sectionId: sections[0].id, blocks: null }];
    update({ sections, slots, nextId, editing: { kind: "section", id: sections[0].id } });
    setView("song");
  }

  /* ---------------- blocks ---------------- */

  const setBlocks = (next: Block[]) => save(withEditingBlocks(songRef.current, next));
  const changeBlock = (i: number, change: Partial<Block>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...change } : b)));
  function addBlock() {
    const at = selectedBlock !== null ? selectedBlock + 1 : blocks.length;
    setBlocks([...blocks.slice(0, at), defaultBlock(), ...blocks.slice(at)]);
    setSelectedBlock(at);
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
    setSelectedBlock(j);
  }
  function removeBlock(i: number) {
    if (blocks.length < 2) return;
    setBlocks(blocks.filter((_, j) => j !== i));
    setSelectedBlock(Math.min(i, blocks.length - 2));
  }

  // Blocks laid out in rows of 4 bars; a block that crosses a row edge is drawn in pieces.
  const segments = useMemo(() => {
    const out: { block: number; row: number; left: number; width: number; cont: boolean; split: boolean }[] = [];
    let cursor = 0;
    blocks.forEach((b, i) => {
      let start = cursor;
      let remaining = blockLength(b);
      let first = true;
      while (remaining > 0.0001) {
        const row = Math.floor(start / BEATS_PER_ROW + 1e-9);
        const pos = start - row * BEATS_PER_ROW;
        const len = Math.min(remaining, BEATS_PER_ROW - pos);
        out.push({ block: i, row, left: pos / BEATS_PER_ROW, width: len / BEATS_PER_ROW, cont: !first, split: remaining - len > 0.0001 });
        first = false;
        start += len;
        remaining -= len;
      }
      cursor += blockLength(b);
    });
    return out;
  }, [blocks]);
  const rowCount = segments.length ? segments[segments.length - 1].row + 1 : 1;

  const selectedSlot = song.slots.find((x) => x.id === selectedSlotId);
  const selectedPlaced = placed.find((p) => p.slot.id === selectedSlotId);

  return (
    <div className="cf" onClick={() => setPicker(false)}>
      {/* ---------------- transport ---------------- */}
      <div className="transport">
        <div className="where">
          {view === "section" ? (
            <>
              <button onClick={() => setView("song")}>← Song</button>
              <span>{editingSection ? editingSection.name : editingSlot ? `${findSection(song, editingSlot.sectionId)?.name}*` : ""}</span>
            </>
          ) : (
            <span>Song</span>
          )}
        </div>
        <div className="controls">
          <button className="tbtn" title="Play" onClick={play} disabled={!hasTracks}>
            ▶
          </button>
          <button className="tbtn" title="Stop" onClick={stop}>
            ■
          </button>
          <button className={loop ? "tbtn on" : "tbtn"} title={loop ? "Stop looping" : "Loop the selection"} onClick={toggleLoop} disabled={!hasTracks || (!loop && !selection)}>
            ⟲
          </button>
          {selectionDiffers && selection && <button onClick={() => startLoop(selection)}>Loop selection</button>}
        </div>
        <span className="loopinfo">{loopRange ? `Looping: ${loopRange.label}` : ""}</span>
        <span className="position">
          {device.playing ? "▶ " : ""}
          {barBeat(device.beats)}
        </span>
        <span className="spacer" />
        <span className={hasTracks ? "sync" : "sync off"}>
          <span className="dot" />
          {hasTracks ? (synced ? "Arrangement in sync" : "Syncing...") : "Choose tracks in settings"}
        </span>
        <button title="Settings" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
      </div>

      {/* ---------------- song view ---------------- */}
      {view === "song" && (
        <div className="view">
          <div className="heading">Song</div>
          <div className="cards">
            {placed.map((p) => (
              <div
                key={p.slot.id}
                className={`card${p.slot.id === selectedSlotId ? " selected" : ""}${playingSlot?.slot.id === p.slot.id ? " playing" : ""}`}
                onClick={() => setSelectedSlotId(p.slot.id === selectedSlotId ? null : p.slot.id)}
                onDoubleClick={() => openEditor(p.slot)}
                title="Click to select, double-click to edit"
              >
                <span className="strip" style={{ background: sectionColor(p.slot.sectionId).css }} />
                <span className="badge">{p.slot.blocks ? "detached" : "🔗"}</span>
                <span className="name">{p.label}</span>
                <span className="sub">
                  {p.index + 1} · {bars(p)}
                </span>
              </div>
            ))}
            <div className="picker" onClick={(e) => e.stopPropagation()}>
              <div className="card add" title={selectedSlot ? "Insert after the selected part" : "Add to the end"} onClick={() => setPicker(!picker)}>
                +
              </div>
              {picker && (
                <div className="picker-menu">
                  {song.sections.map((x) => (
                    <button key={x.id} onClick={() => insertSlot(x.id)}>
                      <span style={{ color: sectionColor(x.id).css }}>●</span> {x.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="toolbar">
            {selectedSlot && selectedPlaced ? (
              <>
                <span>
                  Part {selectedPlaced.index + 1}: <b>{selectedPlaced.label}</b>, {bars(selectedPlaced)}
                </span>
                <button onClick={() => openEditor(selectedSlot)}>Edit</button>
                <button title="Move earlier" disabled={selectedPlaced.index === 0} onClick={() => moveSlot(selectedSlot.id, -1)}>
                  ←
                </button>
                <button title="Move later" disabled={selectedPlaced.index === placed.length - 1} onClick={() => moveSlot(selectedSlot.id, 1)}>
                  →
                </button>
                {selectedSlot.blocks ? <button onClick={() => relinkSlot(selectedSlot)}>Relink</button> : <button onClick={() => detachSlot(selectedSlot)}>Detach</button>}
                <button className="danger" disabled={placed.length < 2} onClick={() => removeSlot(selectedSlot.id)}>
                  Remove
                </button>
              </>
            ) : (
              <span className="note">Click a part to select it. Double-click to edit it. + adds a section after the selected part.</span>
            )}
          </div>

          <div className="heading">Sections</div>
          <div className="cards">
            {song.sections.map((x) => {
              const uses = song.slots.filter((s) => s.sectionId === x.id && !s.blocks).length;
              return (
                <div key={x.id} className="card" onClick={() => openEditor(null, x.id)} title="Click to edit">
                  <span className="strip" style={{ background: sectionColor(x.id).css }} />
                  <span className="name">{x.name}</span>
                  <span className="sub">
                    {x.blocks.length} chord{x.blocks.length === 1 ? "" : "s"} · {uses ? `in song ${uses}×` : "not in song"}
                  </span>
                </div>
              );
            })}
            <div className="card add" title="New section" onClick={newSection}>
              +
            </div>
          </div>
        </div>
      )}

      {/* ---------------- section view ---------------- */}
      {view === "section" && (
        <div className="view">
          <div className="toolbar">
            {editingSection ? (
              <>
                <input value={editingSection.name} onChange={(e) => update({ sections: song.sections.map((x) => (x.id === editingSection.id ? { ...x, name: e.target.value } : x)) })} style={{ width: 150 }} />
                <span className="note">
                  {usesOfSection.length > 1 ? `In the song ${usesOfSection.length} times: changes apply to all of them` : usesOfSection.length === 1 ? "In the song once" : ""}
                </span>
                <button onClick={() => duplicateSection(editingSection.id)}>Duplicate</button>
                <button className="danger" disabled={song.sections.length < 2} onClick={() => deleteSection(editingSection.id)}>
                  Delete section
                </button>
              </>
            ) : editingSlot ? (
              <>
                <span className="note">Detached copy in part {(hearing?.index ?? 0) + 1}: changes apply here only</span>
                <button onClick={() => relinkSlot(editingSlot)}>Relink to {findSection(song, editingSlot.sectionId)?.name}</button>
              </>
            ) : null}
            <span style={{ flex: 1 }} />
            <button onClick={addBlock} title="Insert a chord after the selected one">
              + Add
            </button>
          </div>

          {editingSection && !usesOfSection.length && (
            <div className="banner">
              This section is not in the song, so it is not on the Arrangement and cannot play yet.
              <button
                onClick={() => {
                  setSelectedSlotId(null);
                  insertSlot(editingSection.id);
                }}
              >
                Add to the end of the song
              </button>
            </div>
          )}

          <div className="timeline">
            {Array.from({ length: rowCount }, (_, row) => (
              <div className="trow" key={row}>
                {segments
                  .filter((sg) => sg.row === row)
                  .map((sg, k) => {
                    const b = blocks[sg.block];
                    const label = blockLabel(b, song);
                    const cls = ["block", sg.block === selectedBlock && "selected", sg.block === playingBlock && "playing", sg.cont && "cont", sg.split && "split", b.chordSource === "applied" && "applied"].filter(Boolean).join(" ");
                    return (
                      <div
                        key={k}
                        className={cls}
                        style={{ left: `calc(${sg.left * 100}% + 1px)`, width: `calc(${sg.width * 100}% - 2px)`, background: blockColor(b) }}
                        onClick={() => setSelectedBlock(sg.block)}
                        title={`${label.degree}  ${label.name}`}
                      >
                        {!sg.cont && (
                          <>
                            <span className="deg">{label.degree}</span>
                            <span className="nm">{label.name}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>

          {block && selectedBlock !== null ? (
            <Inspector
              block={block}
              song={song}
              canRemove={blocks.length > 1}
              isFirst={selectedBlock === 0}
              isLast={selectedBlock === blocks.length - 1}
              onChange={(c) => changeBlock(selectedBlock, c)}
              onReset={() => changeBlock(selectedBlock, defaultBlock())}
              onMove={(d) => moveBlock(selectedBlock, d)}
              onRemove={() => removeBlock(selectedBlock)}
            />
          ) : (
            <div className="empty-hint">Click a chord to edit it</div>
          )}
        </div>
      )}

      {/* ---------------- settings drawer ---------------- */}
      {settingsOpen && (
        <>
          <div className="drawer-shade" onClick={() => setSettingsOpen(false)} />
          <div className="drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Settings</strong>
              <button onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <h4>Song</h4>
            <label className="field">
              <span className="field-label">Key</span>
              <select value={song.rootIndex} onChange={(e) => update({ rootIndex: Number(e.target.value) })}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {noteChoiceLabel(i)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Mode</span>
              <select value={song.modeIndex} onChange={(e) => update({ modeIndex: Number(e.target.value) })}>
                {MASTER_MODE_NAMES.map((m, i) => (
                  <option key={i} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Beat</span>
              <select value={song.drumBeat} onChange={(e) => update({ drumBeat: e.target.value })}>
                {Object.keys(BUILTIN_BEAT_PATTERNS).map((k) => (
                  <option key={k} value={k}>
                    {beatPatternLabel(k)}
                  </option>
                ))}
                <option value="off">Off</option>
              </select>
            </label>
            <h4>Tracks</h4>
            {ROLES.map((role) => (
              <label className="field" key={role}>
                <span className="field-label">{role[0].toUpperCase() + role.slice(1)}</span>
                <select
                  value={song.tracks[role]?.id ?? ""}
                  onChange={(e) => {
                    const t = tracks?.find((x) => x.id === Number(e.target.value));
                    update({ tracks: { ...song.tracks, [role]: t ? ({ id: t.id, name: t.name } as TrackRef) : null } });
                  }}
                >
                  <option value="">(none)</option>
                  {(tracks ?? []).map((t) => (
                    <option key={t.id} value={t.id} disabled={!t.midi}>
                      {t.name}
                      {t.midi ? "" : " (audio)"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button onClick={() => outlet(OUT.cf_tracks)}>Refresh track list</button>
            <label className="field">
              <span className="field-label">Bass lowest note</span>
              <select value={song.bassWrapLow} onChange={(e) => update({ bassWrapLow: Number(e.target.value) })}>
                {Array.from({ length: 25 }, (_, i) => 24 + i).map((p) => (
                  <option key={p} value={p}>
                    {pitchToFullNoteName(p)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="danger"
              onClick={() => {
                send(OUT.cf_clear, { trackIds: ROLES.map((r) => song.tracks[r]?.id).filter(Boolean) });
                lastSent.current.clear();
              }}
              title="Deletes every Chord Fiend clip on the chosen tracks. The next edit writes the song again."
            >
              Remove Chord Fiend clips
            </button>
            <h4>Activity</h4>
            <div className="activity">{activity.join("\n") || "-"}</div>
          </div>
        </>
      )}
    </div>
  );
}
