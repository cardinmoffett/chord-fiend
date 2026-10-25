import { useEffect, useMemo, useRef, useState } from "react";
import { bindInlet, decodeBase64, encodeBase64, outlet } from "@m4l-jweb/bridge";
import { useStateSync } from "@m4l-jweb/surface/react";
import {
  MASTER_MODE_NAMES,
  beatPatternLabel,
  beatPatternsForMeter,
  buildChord,
  decodeSharedSong,
  describeSharedSong,
  encodeSharedSong,
  noteChoiceLabel,
  pitchToFullNoteName,
  type SharedSong,
} from "../../../../engine/src/engine.js";
import { Dropdown, IndexDropdown } from "./Dropdown";
import { useDevice } from "../shared/device";
import { Inspector } from "./Inspector";
import { IN, OUT } from "./protocol";
import surface from "./surface";
import {
  DEFAULT_SONG,
  ROLES,
  barBlock,
  blockColor,
  blockLabel,
  blockLength,
  editingBlocks,
  editingLocked,
  findSection,
  inlineSlot,
  layoutSong,
  meterFromLive,
  normalizeSong,
  planSongWrite,
  sectionColor,
  setMeter,
  sharedToSong,
  slotToNewSection,
  songToShared,
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

const send = (selector: string, value: unknown) => outlet(selector, encodeBase64(JSON.stringify(value)));
const barBeat = (beats: number, perBar: number) => `Bar ${Math.floor(beats / perBar) + 1} · ${Math.floor(beats % perBar) + 1}`;
const copyBlocks = (list: Block[]) => list.map((b) => ({ ...b }));

/** What Play is looping: a song part, or just some of its chords (`lo`..`hi`, a selection). */
interface LoopTarget {
  slotId: number;
  lo: number | null;
  hi: number | null;
}

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
  // Shift-click selects several chords: from `anchor` to the selected block. Copy, Paste,
  // ← →, ✕ and Play act on the selection when there is one, as in the app.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<Block[]>([]);
  const [picker, setPicker] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // What Play is looping (Play in the section view), if anything.
  const [loopTarget, setLoopTarget] = useState<LoopTarget | null>(null);
  const [tracks, setTracks] = useState<LiveTrack[] | null>(null);
  const [activity, setActivity] = useState<string[]>([]);
  const [synced, setSynced] = useState<string | null>(null);
  // Copy for phone / Paste from phone (the dialog), and a meter a pasted song asked Live for.
  const [share, setShare] = useState<null | { mode: "copy"; text: string } | { mode: "paste" }>(null);
  const pendingMeter = useRef<{ beats: number; until: number } | null>(null);
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

  // The song follows Live's time signature (3/4 or 4/4). Live has no message for a change, so
  // the window asks on opening and every two seconds after.
  const warnedMeter = useRef("");
  useEffect(() => {
    bindInlet(IN.cf_meter, (b64) => {
      const { numerator, denominator } = JSON.parse(decodeBase64(String(b64)));
      const sig = `${numerator}/${denominator}`;
      const meter = meterFromLive(numerator, denominator);
      if (sig !== "3/4" && sig !== "4/4" && warnedMeter.current !== sig) say(`Live is in ${sig}: Theoryaoke writes 4/4`);
      warnedMeter.current = sig;
      // A pasted song has just asked Live for its meter: until Live shows it (a few seconds at
      // most), Live's old meter must not convert the new song back.
      const pending = pendingMeter.current;
      if (pending) {
        if (meter === pending.beats || Date.now() > pending.until) pendingMeter.current = null;
        else return;
      }
      // Until the Set's saved song has arrived, the window holds the untouched default; saving
      // a converted copy of it then would overwrite the real song. The next poll catches up.
      if (JSON.stringify(songRef.current) === JSON.stringify(DEFAULT_SONG)) return;
      if (meter !== songRef.current.beatsPerBar) {
        save(setMeter(songRef.current, meter));
        say(`time signature: ${meter}/4`);
      }
    });
    outlet(OUT.cf_meter);
    const poll = setInterval(() => outlet(OUT.cf_meter), 2000);
    return () => clearInterval(poll);
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
  const perBar = song.beatsPerBar;
  const beatsPerRow = 4 * perBar;
  // The selected chords, first to last: a shift-click range, or just the selected chord.
  const range: [number, number] | null =
    selectedBlock === null ? null : anchor === null || anchor >= blocks.length ? [selectedBlock, selectedBlock] : [Math.min(anchor, selectedBlock), Math.max(anchor, selectedBlock)];
  const multi = !!range && range[1] > range[0];

  function selectBlock(i: number, extend: boolean) {
    if (extend && selectedBlock !== null) setAnchor(anchor ?? selectedBlock);
    else setAnchor(null);
    setSelectedBlock(i);
  }

  // A song part opens as itself: locked if it is linked to its section, editable if inline.
  function openEditor(slot: Slot | null, sectionId?: number) {
    if (slot) update({ editing: { kind: "slot", id: slot.id } });
    else if (sectionId) update({ editing: { kind: "section", id: sectionId } });
    setSelectedBlock(0);
    setAnchor(null);
    setView("section");
  }

  /* ---------------- transport ---------------- */

  // Play in the section view loops the whole section (where it is heard), starting from the
  // selected chord; with several chords selected, it loops just those. Play in the song view
  // plays the song from the selected part, without a loop.
  const loopPart = loopTarget ? placed.find((p) => p.slot.id === loopTarget.slotId) : undefined;
  // The looped range, in song beats. A selection that no longer fits the part loops the whole part.
  const loopRange = useMemo(() => {
    if (!loopPart || !loopTarget) return undefined;
    const { lo, hi } = loopTarget;
    if (lo === null || hi === null || hi >= loopPart.blocks.length) return { start: loopPart.start, length: loopPart.length, part: true };
    const start = loopPart.start + loopPart.blockStarts[lo];
    const end = loopPart.start + loopPart.blockStarts[hi] + blockLength(loopPart.blocks[hi]);
    return { start, length: end - start, part: false };
  }, [loopPart, loopTarget]);

  // If an edit changes the looped range's length or position, the loop follows it without jumping.
  const sentLoop = useRef("");
  useEffect(() => {
    if (!loopTarget) {
      sentLoop.current = "";
      return;
    }
    if (!loopRange) {
      outlet(OUT.cf_unloop);
      setLoopTarget(null);
      return;
    }
    const key = `${loopRange.start}|${loopRange.length}`;
    if (sentLoop.current && sentLoop.current !== key) outlet(OUT.cf_loop, loopRange.start, loopRange.length, 0);
    sentLoop.current = key;
  }, [loopTarget, loopRange?.start, loopRange?.length]);

  function play() {
    if (view === "section") {
      if (!hearing) return;
      if (multi && range) {
        const start = hearing.start + hearing.blockStarts[range[0]];
        const length = hearing.blockStarts[range[1]] + blockLength(hearing.blocks[range[1]]) - hearing.blockStarts[range[0]];
        sentLoop.current = `${start}|${length}`;
        setLoopTarget({ slotId: hearing.slot.id, lo: range[0], hi: range[1] });
        outlet(OUT.cf_loop, start, length, 1, start);
        return;
      }
      const from = hearing.start + (selectedBlock !== null && selectedBlock < hearing.blocks.length ? hearing.blockStarts[selectedBlock] : 0);
      sentLoop.current = `${hearing.start}|${hearing.length}`;
      setLoopTarget({ slotId: hearing.slot.id, lo: null, hi: null });
      outlet(OUT.cf_loop, hearing.start, hearing.length, 1, from);
    } else {
      setLoopTarget(null);
      outlet(OUT.cf_play, placed.find((p) => p.slot.id === selectedSlotId)?.start ?? 0);
    }
  }
  function stop() {
    outlet(OUT.cf_stop);
    setLoopTarget(null);
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
  function newSection() {
    const s = songRef.current;
    const id = s.nextId;
    save({
      ...s,
      sections: [...s.sections, { id, name: `Section ${s.sections.length + 1}`, blocks: [barBlock(s.beatsPerBar)] }],
      nextId: id + 1,
      editing: { kind: "section", id },
    });
    setSelectedBlock(0);
    setAnchor(null);
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

  /* ---------------- sharing with the phone ---------------- */

  // A song from the phone replaces this device's song (the dialog says so first); the track
  // choices stay. Its meter becomes Live's time signature.
  function applyShared(shared: SharedSong) {
    const next = sharedToSong(shared, songRef.current);
    save(next);
    setView("song");
    setSelectedSlotId(null);
    setSelectedSectionId(null);
    setSelectedBlock(0);
    setAnchor(null);
    if (warnedMeter.current !== `${next.beatsPerBar}/4`) {
      pendingMeter.current = { beats: next.beatsPerBar, until: Date.now() + 6000 };
      outlet(OUT.cf_set_meter, next.beatsPerBar);
    }
    say(`pasted "${shared.name}" from the phone`);
    setShare(null);
    setSettingsOpen(false);
  }

  /* ---------------- blocks ---------------- */

  const setBlocks = (next: Block[]) => save(withEditingBlocks(songRef.current, next));
  const changeBlock = (i: number, change: Partial<Block>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...change } : b)));
  // + Add duplicates: a copy of the selected chord (the last one, with several selected) goes
  // right after it; with nothing selected, a copy of the last chord goes at the end.
  function addBlock() {
    const from = range ? range[1] : blocks.length - 1;
    const at = from + 1;
    const copy = blocks[from] ? { ...blocks[from] } : barBlock(perBar);
    setBlocks([...blocks.slice(0, at), copy, ...blocks.slice(at)]);
    setSelectedBlock(at);
    setAnchor(null);
  }
  // ← → move the selected chords together, and the selection moves with them.
  function moveSelection(dir: -1 | 1) {
    if (!range) return;
    const [lo, hi] = range;
    if (lo + dir < 0 || hi + dir >= blocks.length) return;
    const next = [...blocks];
    const moving = next.splice(lo, hi - lo + 1);
    next.splice(lo + dir, 0, ...moving);
    setBlocks(next);
    setSelectedBlock(selectedBlock! + dir);
    if (anchor !== null) setAnchor(anchor + dir);
  }
  function removeSelection() {
    if (!range || blocks.length - (range[1] - range[0] + 1) < 1) return;
    setBlocks([...blocks.slice(0, range[0]), ...blocks.slice(range[1] + 1)]);
    setSelectedBlock(Math.min(range[0], blocks.length - (range[1] - range[0] + 1) - 1));
    setAnchor(null);
  }
  // Copy takes the selected chords (or the one selected chord); Paste inserts copies after the
  // selection, in any section or part, and selects what it pasted. The clipboard lasts while the window is open.
  function copySelection() {
    if (!range) return;
    setClipboard(copyBlocks(blocks.slice(range[0], range[1] + 1)));
    say(`copied ${range[1] - range[0] + 1} chord(s)`);
  }
  function paste() {
    if (locked || !clipboard.length) return;
    const at = range ? range[1] + 1 : blocks.length;
    setBlocks([...blocks.slice(0, at), ...copyBlocks(clipboard), ...blocks.slice(at)]);
    setAnchor(at);
    setSelectedBlock(at + clipboard.length - 1);
  }

  // Keyboard: Cmd/Ctrl+C and V copy and paste, Delete removes, in the section view (not while typing a name).
  const keys = useRef({ copySelection, paste, removeSelection, locked, view });
  keys.current = { copySelection, paste, removeSelection, locked, view };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (k.view !== "section" || (e.target as HTMLElement).closest("input, textarea")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "c") k.copySelection();
      else if (mod && e.key.toLowerCase() === "v") k.paste();
      else if ((e.key === "Delete" || e.key === "Backspace") && !k.locked) k.removeSelection();
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Blocks laid out in rows of 4 bars; a block that crosses a row edge is drawn in pieces.
  const segments = useMemo(() => {
    const out: { block: number; row: number; left: number; width: number; cont: boolean; split: boolean }[] = [];
    let cursor = 0;
    blocks.forEach((b, i) => {
      let start = cursor;
      let remaining = blockLength(b);
      let first = true;
      while (remaining > 0.0001) {
        const row = Math.floor(start / beatsPerRow + 1e-9);
        const pos = start - row * beatsPerRow;
        const len = Math.min(remaining, beatsPerRow - pos);
        out.push({ block: i, row, left: pos / beatsPerRow, width: len / beatsPerRow, cont: !first, split: remaining - len > 0.0001 });
        first = false;
        start += len;
        remaining -= len;
      }
      cursor += blockLength(b);
    });
    return out;
  }, [blocks, beatsPerRow]);
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
            title={
              view === "section"
                ? multi
                  ? "Loop the selected chords"
                  : "Loop this section, from the selected chord (shift-click to select several chords and loop just those)"
                : "Play the song from the selected part"
            }
            onClick={play}
            disabled={!hasTracks || (view === "section" && !hearing)}
          >
            ▶
          </button>
          <button className="tbtn" title="Stop" onClick={stop}>
            ■
          </button>
        </div>
        <span className="loopinfo">
          {loopPart && loopRange && device.playing
            ? `Looping ${loopPart.label}${loopRange.part || !loopTarget || loopTarget.lo === null ? "" : `, chords ${loopTarget.lo + 1}–${loopTarget.hi! + 1}`}`
            : ""}
        </span>
        <span className="position">
          {device.playing ? "▶ " : ""}
          {barBeat(device.beats, perBar)}
          {perBar === 3 ? "  (3/4)" : ""}
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
              <span className="locked-note">🔗 {findSection(song, editingSlot.sectionId)?.name}</span>
            ) : editingSlot ? (
              <button
                onClick={() => save(slotToNewSection(songRef.current, editingSlot.id))}
                title="Make this part's chords a new section, and link this part to it"
              >
                🔗 New linked section
              </button>
            ) : null}
            <span style={{ flex: 1 }} />
            <button onClick={copySelection} disabled={!range} title="Copy the selected chords (⌘C). Shift-click to select several.">
              Copy
            </button>
            <button onClick={paste} disabled={locked || !clipboard.length} title="Paste after the selected chords (⌘V)">
              Paste{clipboard.length > 1 ? ` ${clipboard.length}` : ""}
            </button>
            <button onClick={addBlock} disabled={locked} title="Add a copy of the selected chord after it">
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
                      multi && range && sg.block >= range[0] && sg.block <= range[1] && "in-range",
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
                        onClick={(e) => {
                          selectBlock(sg.block, e.shiftKey);
                          if (!e.shiftKey) audition(b);
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
            {block && selectedBlock !== null && range ? (
              <div className="inspector-wrap">
                <Inspector
                  block={block}
                  song={song}
                  locked={locked}
                  canRemove={blocks.length > range[1] - range[0] + 1}
                  isFirst={range[0] === 0}
                  isLast={range[1] === blocks.length - 1}
                  onChange={(c) => {
                    changeBlock(selectedBlock, c);
                    audition({ ...block, ...c });
                  }}
                  onReset={() => changeBlock(selectedBlock, barBlock(perBar))}
                  onMove={moveSelection}
                  onRemove={removeSelection}
                />
                {/* A linked part is locked: these sit over its greyed-out editor. */}
                {locked && editingSlot && (
                  <div className="lock-overlay">
                    <button onClick={() => openEditor(null, editingSlot.sectionId)} title="Edit the section: the change shows in every part linked to it">
                      Edit source
                    </button>
                    <button onClick={() => save(inlineSlot(songRef.current, editingSlot.id))} title="Give this part its own copy of the chords, to change on its own">
                      Edit instance
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-hint">Click a chord to edit it</div>
            )}
          </div>
        </div>
      )}

      {share && (
        <ShareDialog
          share={share}
          onClose={() => setShare(null)}
          onCopied={() => say("copied for the phone")}
          onReplace={applyShared}
        />
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
                  ...beatPatternsForMeter(perBar).map((k) => ({ value: k, label: beatPatternLabel(k) })),
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
            <h4>Phone</h4>
            <button onClick={() => setShare({ mode: "copy", text: encodeSharedSong(songToShared(songRef.current, device.tempo)) })}>
              Copy for phone
            </button>
            <button onClick={() => setShare({ mode: "paste" })}>Paste from phone…</button>
            <button
              className="danger"
              onClick={() => {
                send(OUT.cf_clear, { trackIds: ROLES.map((r) => song.tracks[r]?.id).filter(Boolean) });
                lastSent.current.clear();
              }}
              title="Deletes every Theoryaoke clip on the chosen tracks. The next edit writes the song again."
            >
              Remove Theoryaoke clips
            </button>
            <h4>Activity</h4>
            <div className="activity">{activity.join("\n") || "-"}</div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Copy for phone: the song as text, selected, to copy with Cmd+C. Inside Live's window a
 * programmatic copy can claim success and copy nothing, so the dialog waits for the
 * browser's own copy event, which only fires when a copy really happened.
 *
 * Paste from phone: paste with Cmd+V, see what the song holds, then Replace (or Cancel).
 */
function ShareDialog({
  share,
  onClose,
  onCopied,
  onReplace,
}: {
  share: { mode: "copy"; text: string } | { mode: "paste" };
  onClose: () => void;
  onCopied: () => void;
  onReplace: (song: SharedSong) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    field.current?.focus();
    if (share.mode === "copy") field.current?.select();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  let found: SharedSong | null = null;
  let problem = "";
  if (share.mode === "paste" && pasted.trim()) {
    try {
      found = decodeSharedSong(pasted);
    } catch (e) {
      problem = (e as Error).message;
    }
  }
  return (
    <>
      <div className="drawer-shade share-shade" onClick={onClose} />
      <div className="share-dialog">
        <strong>{share.mode === "copy" ? "Copy for phone" : "Paste from phone"}</strong>
        <div className="share-note">
          {share.mode === "copy"
            ? copied
              ? "Copied. On the phone, open the project menu and use Paste from Live."
              : "Press ⌘C to copy it. Then, on the phone, open the project menu and use Paste from Live."
            : "On the phone, use Send to Live in the project menu. Then press ⌘V here."}
        </div>
        {share.mode === "copy" ? (
          <textarea
            ref={field}
            readOnly
            value={share.text}
            onCopy={() => {
              setCopied(true);
              onCopied();
            }}
          />
        ) : (
          <textarea ref={field} value={pasted} placeholder="Paste the song here (⌘V)" onChange={(e) => setPasted(e.target.value)} />
        )}
        {share.mode === "paste" && (
          <div className={found ? "share-found" : "share-note"}>
            {found ? `${found.name}: ${describeSharedSong(found)}` : problem || " "}
          </div>
        )}
        {share.mode === "paste" && found && <div className="share-note">This replaces the song in this device. The tracks you chose stay.</div>}
        <div className="share-buttons">
          {share.mode === "paste" && (
            <button className="danger" disabled={!found} onClick={() => found && onReplace(found)}>
              Replace this song
            </button>
          )}
          <button onClick={onClose}>{share.mode === "copy" && copied ? "Done" : share.mode === "copy" ? "Close" : "Cancel"}</button>
        </div>
      </div>
    </>
  );
}
