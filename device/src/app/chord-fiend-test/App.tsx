import { useEffect } from "react";
import { bindInlet, decodeBase64, flushNotes, sendNote } from "@m4l-jweb/bridge";
import { useStateSync, useWindow } from "@m4l-jweb/surface/react";
import { useDevice } from "../shared/device";
import { Frame, Transport } from "../shared/Frame";
import { IN } from "./protocol";
import surface from "./surface";
import { normalizeSong, slotLabel } from "./song";

/**
 * The device strip on the track: 169 px tall, so it opens the editor and shows the song
 * order. It also plays the chords tapped in the editor: only this page is wired to the
 * device's MIDI out, so the window sends them here (through the wrapper).
 */
export default function App() {
  const device = useDevice();
  const editor = useWindow(surface, "editor");
  const [stored] = useStateSync(surface, "song");
  const song = normalizeSong(stored);

  useEffect(() => {
    bindInlet(IN.cf_audition, (b64) => {
      const { pitches, velocity, durationMs } = JSON.parse(decodeBase64(String(b64)));
      flushNotes(); // end the previous chord first, so taps never pile up
      for (const pitch of pitches) sendNote({ pitch, velocity, durationMs });
    });
  }, []);

  return (
    <Frame title="CHORD FIEND (feel test)" device={device}>
      <dt>editor</dt>
      <dd style={{ display: "flex", gap: 8 }}>
        <button onClick={editor.open} style={{ padding: "4px 10px" }}>
          Open editor
        </button>
        <button onClick={editor.close} style={{ padding: "4px 10px" }}>
          Close
        </button>
      </dd>
      <dt>song</dt>
      <dd>{song.slots.map((s) => slotLabel(song, s)).join("  ")}</dd>
      <Transport device={device} />
    </Frame>
  );
}
