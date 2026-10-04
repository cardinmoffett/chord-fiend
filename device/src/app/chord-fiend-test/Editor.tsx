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
  getDurationBeats,
  noteChoiceLabel,
  pitchToFullNoteName,
} from "../../../../engine/src/engine.js";
import { sectionToNotes } from "../../../../engine/src/notes.js";
import { useDevice } from "../shared/device";
import { IN, OUT } from "./protocol";
import surface, { DEFAULT_SONG, type Block, type Song, type TrackRef } from "./surface";

type Role = "chords" | "bass" | "drums";
const ROLES: Role[] = ["chords", "bass", "drums"];
const BEATS_PER_BAR = 4;

interface LiveTrack {
  id: number;
  name: string;
  midi: boolean;
}

function send(selector: string, value: unknown) {
  outlet(selector, encodeBase64(JSON.stringify(value)));
}

/** The editor window: the feel test's whole interface. */
export default function Editor() {
  const device = useDevice();
  const [stored, setStored] = useStateSync(surface, "song");
  const song: Song = stored ?? DEFAULT_SONG;
  const [tracks, setTracks] = useState<LiveTrack[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [written, setWritten] = useState(false);
  const [paste, setPaste] = useState("");

  const songRef = useRef(song);
  songRef.current = song;
  const update = (change: Partial<Song>) => setStored({ ...songRef.current, ...change });
  const say = (line: string) => setLog((l) => [new Date().toLocaleTimeString() + "  " + line, ...l].slice(0, 12));

  useEffect(() => {
    bindInlet(IN.cf_tracks, (b64) => setTracks(JSON.parse(decodeBase64(String(b64)))));
    bindInlet(IN.cf_result, (b64) => {
      const r = JSON.parse(decodeBase64(String(b64)));
      if (r.role === "clear") say(r.ok ? `cleared ${r.deleted} clips` : `clear FAILED: ${r.error}`);
      else say(r.ok ? `${r.role}: ${r.action} clip, ${r.notes} notes` : `${r.role}: FAILED - ${r.error}`);
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

  const settings = { rootIndex: song.rootIndex, modeIndex: song.modeIndex, drumBeat: song.drumBeat, bassEnabled: song.bassEnabled, bassWrapLow: song.bassWrapLow };
  const notes = useMemo(() => sectionToNotes(song.blocks, settings), [song]);
  const start = (Math.max(1, song.startBar) - 1) * BEATS_PER_BAR;

  function writeAll(reason: string) {
    const roles = ROLES.filter((r) => songRef.current.tracks[r]);
    if (!roles.length) {
      say("pick at least one track first");
      return;
    }
    for (const role of roles) {
      const list = notes[role];
      send(OUT.cf_write, {
        role,
        trackId: songRef.current.tracks[role]!.id,
        start,
        length: notes.lengthBeats,
        notes: list.map((n) => [n.pitch, n.start, n.duration, n.velocity]),
      });
    }
    setWritten(true);
    say(`writing (${reason}) at bar ${song.startBar}, ${notes.lengthBeats} beats`);
  }

  // Rewrite on every edit once something has been written: this is the mid-loop rewrite test.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!song.autoWrite || !written) return;
    const t = setTimeout(() => writeAll("edit"), 120);
    return () => clearTimeout(t);
  }, [notes]);

  function clearAll() {
    const ids = ROLES.map((r) => song.tracks[r]?.id).filter((x): x is number => !!x);
    send(OUT.cf_clear, { trackIds: ids });
    setWritten(false);
  }

  function setBlock(i: number, change: Partial<Block>) {
    update({ blocks: song.blocks.map((b, j) => (j === i ? { ...b, ...change } : b)) });
  }

  const playingBlock = device.playing
    ? notes.blockStarts.findIndex((s, i) => device.beats >= start + s && device.beats < start + s + getDurationBeats(song.blocks[i]))
    : -1;
  const homeLabels = degreeLabels(MASTER_MODE_NAMES[song.modeIndex]);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#ddd", background: "#1e1e1e", minHeight: "100vh", boxSizing: "border-box" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <strong style={{ fontSize: 16 }}>Chord Fiend - feel test</strong>
        <Pick label="Key" value={song.rootIndex} options={Array.from({ length: 12 }, (_, i) => noteChoiceLabel(i))} onChange={(v) => update({ rootIndex: v })} />
        <Pick label="Mode" value={song.modeIndex} options={MASTER_MODE_NAMES} onChange={(v) => update({ modeIndex: v })} />
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
          Start at bar{" "}
          <input type="number" min={1} value={song.startBar} style={{ width: 56 }} onChange={(e) => update({ startBar: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
      </header>

      <section style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
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

      <section style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {song.blocks.map((b, i) => {
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
                <button onClick={() => outlet(OUT.cf_loop, start + notes.blockStarts[i], getDurationBeats(b))}>Loop</button>
                <button disabled={song.blocks.length < 2} onClick={() => update({ blocks: song.blocks.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button style={{ width: 80 }} onClick={() => update({ blocks: [...song.blocks, defaultBlock()] })}>
          + Block
        </button>
      </section>

      <section style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => writeAll("button")} style={{ padding: "6px 12px", fontWeight: 600 }}>
          Write to Arrangement
        </button>
        <label>
          <input type="checkbox" checked={song.autoWrite} onChange={(e) => update({ autoWrite: e.target.checked })} /> Rewrite on every edit
        </label>
        <button onClick={clearAll}>Remove our clips</button>
        <span style={{ width: 16 }} />
        <button onClick={() => outlet(OUT.cf_loop, start, notes.lengthBeats)}>Loop section</button>
        <button onClick={() => outlet(OUT.cf_play, start)}>Play from start</button>
        <button onClick={() => outlet(OUT.cf_stop)}>Stop</button>
        <span style={{ opacity: 0.7 }}>
          {device.playing ? "playing" : "stopped"} at beat {device.beats.toFixed(2)} (section: beats {start} to {start + notes.lengthBeats})
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

function Pick({ label, value, options, onChange }: { label: string; value: number; options: readonly string[]; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "block", margin: "3px 0" }}>
      <span style={{ display: "inline-block", minWidth: 64, opacity: 0.7 }}>{label}</span>
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
