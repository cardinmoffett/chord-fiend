import { defineSurface, state, window } from "@m4l-jweb/surface";
import { DEFAULT_SONG, type Song } from "./song";

export default defineSurface({
  params: {},
  banks: [],
  state: {
    // Typed loosely on purpose: a Set saved by an earlier version holds an older shape.
    // Read it through normalizeSong() in song.ts.
    song: state<Song | Record<string, unknown>>({ default: DEFAULT_SONG }),
  },
  windows: {
    editor: window({ title: "Chord Fiend (feel test)", width: 1200, height: 760, entry: "Editor" }),
  },
});
