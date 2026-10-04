import { useEffect, useMemo, useRef, useState } from "react";
import { bindInlet, decodeBase64, encodeBase64, outlet } from "@m4l-jweb/bridge";
import { useStateSync } from "@m4l-jweb/surface/react";
import {
  BUILTIN_BEAT_PATTERNS,
  MASTER_MODE_NAMES,
  beatPatternLabel,
  buildChord,
  defaultBlock,
  noteChoiceLabel,
  pitchToFullNoteName,
} from "../../../../engine/src/engine.js";
import { Dropdown, IndexDropdown } from "./Dropdown";
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
  editingLocked,
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

const BEATS_PER_ROW = 4 * BEATS_PER_BAR;
const send = (selector: string, value: unknown) => outlet(selector, encodeBase64(JSON.stringify(value)));
const barBeat = (beats: number) => `Bar ${Math.floor(beats / BEATS_PER_BAR) + 1} · ${Math.floor(beats % BEATS_PER_BAR) + 1}`;

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
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [confirmRelink, setConfirmRelink] = useState(false);
  const [partAdd, setPartAdd] = useState(false);

  // The selected part's flyout closes on Escape or a click away from it.
  useEffect(() => {
    if (selectedSlotId === null) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSelectedSlotId(null);
    const away = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".card-wrap, .picker, .transport, .drawer, .drawer-shade")) return;
      setSelectedSlotId(null);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", away);
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("mousedown", away);
    };
  }, [selectedSlotId]);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [picker, setPicker] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The song part whose section Play is looping (Play in the section view), if any.
  const [loopSlotId, setLoopSlotId] = useState<number | null>(null);
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
  // Where the blocks being edited are heard: the part being edited, or the first place the section is used.
  const hearing: PlacedSlot | undefined = editingSlot ? placed.find((p) => p.slot.id === editingSlot.id) : usesOfSection[0];
  const block = selectedBlock !== null ? blocks[selectedBlock] : undefined;
  const locked = editingLocked(song);

  // A song part opens as itself: locked if it is linked to its section, editable if inline.
  function openEditor(slot: Slot | null, sectionId?: number) {
    setConfirmRelink(false);
    if (slot) update({ editing: { kind: "slot", id: slot.id } });
    else if (sectionId) update({ editing: { kind: "section", id: sectionId } });
    setSelectedBlock(0);
    setView("section");
  }

  /* ---------------- transport ---------------- */

  // Play in the section view loops the whole section (where it is heard), starting from the
  // selected chord. Play in the song view plays the song from the selected part, without a loop.
  const loopPart = loopSlotId !== null ? placed.find((p) => p.slot.id === loopSlotId) : undefined;

  // If an edit changes the looping section's length or position, the loop follows it without jumping.
  const sentLoop = useRef("");
  useEffect(() => {
    if (loopSlotId === null) {
      sentLoop.current = "";
      return;
    }
    if (!loopPart) {
      outlet(OUT.cf_unloop);
      setLoopSlotId(null);
      return;
    }
    const key = `${loopPart.start}|${loopPart.length}`;
    if (sentLoop.current && sentLoop.current !== key) outlet(OUT.cf_loop, loopPart.start, loopPart.length, 0);
    sentLoop.current = key;
  }, [loopSlotId, loopPart?.start, loopPart?.length]);

  function play() {
    if (view === "section") {
      if (!hearing) return;
      const from = hearing.start + (selectedBlock !== null && selectedBlock < hearing.blocks.length ? hearing.blockStarts[selectedBlock] : 0);
      sentLoop.current = `${hearing.start}|${hearing.length}`;
      setLoopSlotId(hearing.slot.id);
      outlet(OUT.cf_loop, hearing.start, hearing.length, 1, from);
    } else {
      setLoopSlotId(null);
      outlet(OUT.cf_play, placed.find((p) => p.slot.id === selectedSlotId)?.start ?? 0);
    }
  }
  function stop() {
    outlet(OUT.cf_stop);
    setLoopSlotId(null);
  }

  // Tapping a chord plays it, but only while stopped: during playback a tap only selects, so
  // you can edit along with the music.
  function audition(b: Block) {
    if (device.playing) return;
    const chord = buildChord(b, songRef.current.rootIndex, songRef.current.modeIndex);
    send(OUT.cf_audition, { pitches: chord.pitches, velocity: 96, durationMs: 900 });
  }

  const playingSlot = device.playing ? placed.find((p) => device.beats >= p.start && device.beats < p.start + p.length) : undefined;
  const playingHere =
    playingSlot &&
    (editingSlot ? playingSlot.slot.id === editingSlot.id : !playingSlot.slot.blocks && playingSlot.slot.sectionId === editingSection?.id);
  const playingBlock = playingHere
    ? playingSlot!.blockStarts.findIndex(
        (s, i) => device.beats >= playingSlot!.start + s && device.beats < playingSlot!.start + s + blockLength(playingSlot!.blocks[i]),
      )
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
    const slot = song.slots.find((x) => x.id === id)!;
    const editing = song.editing.kind === "slot" && song.editing.id === id ? { kind: "section" as const, id: slot.sectionId } : song.editing;
    update({ slots: song.slots.filter((x) => x.id !== id), editing });
    setSelectedSlotId(null);
  }
  // Make inline: this part gets its own copy of the section's chords, edited on its own.
  function makeInline(slot: Slot) {
    const copy = (findSection(song, slot.sectionId)?.blocks ?? []).map((b) => ({ ...b }));
    update({ slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks: copy } : x)) });
  }
  // Relink: the part follows its section again, and its own changes are gone (asked first).
  function relinkSlot(slot: Slot) {
    update({ slots: song.slots.map((x) => (x.id === slot.id ? { ...x, blocks: null } : x)) });
    setConfirmRelink(false);
  }
  function newSection() {
    const s = songRef.current;
    const id = s.nextId;
    save({
      ...s,
      sections: [...s.sections, { id, name: `Section ${s.sections.length + 1}`, blocks: [defaultBlock()] }],
      nextId: id + 1,
      editing: { kind: "section", id },
    });
    setSelectedBlock(0);
    setView("section");
  }
  function duplicateSection(id: number) {
    const src = findSection(song, id);
    if (!src) return;
    const nid = song.nextId;
    update({ sections: [...song.sections, { id: nid, name: src.name + " copy", blocks: src.blocks.map((b) => ({ ...b })) }], nextId: nid + 1 });
    setSelectedSectionId(nid);
  }
  function deleteSection(id: number) {
    if (song.sections.length < 2) return;
    const sections = song.sections.filter((x) => x.id !== id);
    const slots = song.slots.filter((x) => x.sectionId !== id);
    update({ sections, slots, editing: { kind: "section", id: sections[0].id } });
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

  return (
    <div className="cf" onClick={() => setPicker(false)}>
      {/* ---------------- transport ---------------- */}
      <div className="transport">
        <div className="where">
          {view === "section" ? (
            <>
              <button onClick={() => setView("song")}>← Song</button>
              <span>{editingSection ? editingSection.name : editingSlot ? (hearing?.label ?? "") : ""}</span>
            </>
          ) : (
            <span>Song</span>
          )}
        </div>
        <div className="controls">
          <button
            className={device.playing ? "tbtn on" : "tbtn"}
            title={view === "section" ? "Loop this section, from the selected chord" : "Play the song from the selected part"}
            onClick={play}
            disabled={!hasTracks || (view === "section" && !hearing)}
          >
            ▶
          </button>
          <button className="tbtn" title="Stop" onClick={stop}>
            ■
          </button>
        </div>
        <span className="loopinfo">{loopPart && device.playing ? `Looping ${loopPart.label}` : ""}</span>
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
        <div className="song-view">
          <div className="heading">Song</div>
          <div className="cards">
            {placed.map((p) => (
              <div key={p.slot.id} className="card-wrap">
                <div
                  className={`card${p.slot.id === selectedSlotId ? " selected" : ""}${playingSlot?.slot.id === p.slot.id ? " playing" : ""}`}
                  onClick={() => {
                    setSelectedSlotId(p.slot.id === selectedSlotId ? null : p.slot.id);
                    setSelectedSectionId(null);
                    setPartAdd(false);
                  }}
                  onDoubleClick={() => openEditor(p.slot)}
                >
                  <span className="strip" style={{ background: sectionColor(p.slot.sectionId).css }} />
                  {!p.slot.blocks && <span className="badge">🔗</span>}
                  <span className="name">{p.label}</span>
                </div>
                {/* The selected part's menu: a flyout attached to its card. */}
                {p.slot.id === selectedSlotId && (
                  <div className="part-flyout">
                    <span className="part-flyout-arrow" />
                    <div className="part-flyout-buttons">
                      <button title="Move earlier" disabled={p.index === 0} onClick={() => moveSlot(p.slot.id, -1)}>
                        ←
                      </button>
                      <button title="Move later" disabled={p.index === placed.length - 1} onClick={() => moveSlot(p.slot.id, 1)}>
                        →
                      </button>
                      <button title="Remove from the song" className="danger" onClick={() => removeSlot(p.slot.id)}>
                        ✕
                      </button>
                      <button title="Insert a section after this part" className={partAdd ? "add on" : "add"} onClick={() => setPartAdd(!partAdd)}>
                        + Add
                      </button>
                    </div>
                    {partAdd && (
                      <div className="part-flyout-list">
                        {song.sections.map((x) => (
                          <button
                            key={x.id}
                            onClick={() => {
                              insertSlot(x.id);
                              setPartAdd(false);
                            }}
                          >
                            <span style={{ color: sectionColor(x.id).css }}>●</span> {x.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

          <div className="palette">
            <div className="heading">Sections</div>
            <div className="cards">
              {song.sections.map((x) => (
                <div
                  key={x.id}
                  className={x.id === selectedSectionId ? "card selected" : "card"}
                  onClick={() => {
                    setSelectedSectionId(x.id === selectedSectionId ? null : x.id);
                    setSelectedSlotId(null);
                  }}
                  onDoubleClick={() => openEditor(null, x.id)}
                >
                  <span className="strip" style={{ background: sectionColor(x.id).css }} />
                  <span className="name">{x.name}</span>
                </div>
              ))}
              <div className="card add" title="New section" onClick={newSection}>
                +
              </div>
            </div>
            <div className="toolbar slim">
              {selectedSectionId !== null && findSection(song, selectedSectionId) && (
                <button onClick={() => duplicateSection(selectedSectionId)}>Duplicate</button>
              )}
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
                <input
                  value={editingSection.name}
                  onChange={(e) => update({ sections: song.sections.map((x) => (x.id === editingSection.id ? { ...x, name: e.target.value } : x)) })}
                  style={{ width: 150 }}
                />
                <button className="danger" disabled={song.sections.length < 2} onClick={() => deleteSection(editingSection.id)}>
                  Delete section
                </button>
              </>
            ) : editingSlot && locked ? (
              <>
                <span className="locked-note">🔗 {findSection(song, editingSlot.sectionId)?.name}</span>
                <button onClick={() => makeInline(editingSlot)}>Make inline</button>
              </>
            ) : editingSlot ? (
              confirmRelink ? (
                <span className="confirm">
                  Relink to {findSection(song, editingSlot.sectionId)?.name}? This part's own changes will be lost.
                  <button className="danger" onClick={() => relinkSlot(editingSlot)}>
                    Relink
                  </button>
                  <button onClick={() => setConfirmRelink(false)}>Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmRelink(true)}>Relink</button>
              )
            ) : null}
            <span style={{ flex: 1 }} />
            <button onClick={addBlock} disabled={locked} title="Insert a chord after the selected one">
              + Add
            </button>
          </div>

          {editingSection && !usesOfSection.length && (
            <div className="banner">
              Not in the song yet.
              <button
                onClick={() => {
                  setSelectedSlotId(null);
                  insertSlot(editingSection.id);
                }}
              >
                Add to song
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
                    const cls = [
                      "block",
                      sg.block === selectedBlock && "selected",
                      sg.block === playingBlock && "playing",
                      sg.cont && "cont",
                      sg.split && "split",
                      b.chordSource === "applied" && "applied",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <div
                        key={k}
                        className={cls}
                        style={{ left: `calc(${sg.left * 100}% + 1px)`, width: `calc(${sg.width * 100}% - 2px)`, background: blockColor(b) }}
                        onClick={() => {
                          setSelectedBlock(sg.block);
                          audition(b);
                        }}
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

          <div className="section-bottom">
            {block && selectedBlock !== null ? (
              <Inspector
                block={block}
                song={song}
                locked={locked}
                canRemove={blocks.length > 1}
                isFirst={selectedBlock === 0}
                isLast={selectedBlock === blocks.length - 1}
                onChange={(c) => {
                  changeBlock(selectedBlock, c);
                  audition({ ...block, ...c });
                }}
                onReset={() => changeBlock(selectedBlock, defaultBlock())}
                onMove={(d) => moveBlock(selectedBlock, d)}
                onRemove={() => removeBlock(selectedBlock)}
              />
            ) : (
              <div className="empty-hint">Click a chord to edit it</div>
            )}
          </div>
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
            <div className="field">
              <span className="field-label">Key</span>
              <IndexDropdown
                value={song.rootIndex}
                options={Array.from({ length: 12 }, (_, i) => noteChoiceLabel(i))}
                onChange={(v) => update({ rootIndex: v })}
              />
            </div>
            <div className="field">
              <span className="field-label">Mode</span>
              <IndexDropdown value={song.modeIndex} options={MASTER_MODE_NAMES} onChange={(v) => update({ modeIndex: v })} />
            </div>
            <div className="field">
              <span className="field-label">Beat</span>
              <Dropdown
                value={song.drumBeat}
                options={[
                  ...Object.keys(BUILTIN_BEAT_PATTERNS).map((k) => ({ value: k, label: beatPatternLabel(k) })),
                  { value: "off", label: "Off" },
                ]}
                onChange={(v) => update({ drumBeat: String(v) })}
              />
            </div>
            <h4>Tracks</h4>
            {ROLES.map((role) => (
              <div className="field" key={role}>
                <span className="field-label">{role[0].toUpperCase() + role.slice(1)}</span>
                <Dropdown
                  value={song.tracks[role]?.id ?? ""}
                  options={[
                    { value: "", label: "(none)" },
                    ...(tracks ?? []).map((t) => ({ value: t.id, label: t.name + (t.midi ? "" : " (audio)"), disabled: !t.midi })),
                  ]}
                  onChange={(v) => {
                    const t = tracks?.find((x) => x.id === v);
                    update({ tracks: { ...song.tracks, [role]: t ? ({ id: t.id, name: t.name } as TrackRef) : null } });
                  }}
                />
              </div>
            ))}
            <button onClick={() => outlet(OUT.cf_tracks)}>Refresh track list</button>
            <div className="field">
              <span className="field-label">Bass lowest note</span>
              <Dropdown
                value={song.bassWrapLow}
                options={Array.from({ length: 25 }, (_, i) => ({ value: 24 + i, label: pitchToFullNoteName(24 + i) }))}
                onChange={(v) => update({ bassWrapLow: Number(v) })}
              />
            </div>
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
