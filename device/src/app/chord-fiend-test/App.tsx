import { useStateSync, useWindow } from "@m4l-jweb/surface/react";
import { useDevice } from "../shared/device";
import { Frame, Transport } from "../shared/Frame";
import surface from "./surface";
import { normalizeSong, slotLabel } from "./song";

/** The device strip on the track: 169 px tall, so it only opens the editor and shows the song order. */
export default function App() {
  const device = useDevice();
  const editor = useWindow(surface, "editor");
  const [stored] = useStateSync(surface, "song");
  const song = normalizeSong(stored);

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
