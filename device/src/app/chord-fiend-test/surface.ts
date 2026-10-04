import { defineSurface, state, window } from "@m4l-jweb/surface";
import { defaultBlock, type Block } from "../../../../engine/src/engine.js";

export interface TrackRef {
  id: number;
  name: string;
}

export type { Block };

/** Everything the feel test remembers, saved in the Live Set. */
export interface Song {
  rootIndex: number;
  modeIndex: number;
  drumBeat: string;
  bassEnabled: boolean;
  bassWrapLow: number;
  startBar: number;
  autoWrite: boolean;
  blocks: Block[];
  tracks: { chords: TrackRef | null; bass: TrackRef | null; drums: TrackRef | null };
}

function blk(o: Partial<Block>): Block {
  return { ...defaultBlock(), ...o };
}

// I - vi - IV - V in C major, a bar each: something to hear straight away.
export const DEFAULT_SONG: Song = {
  rootIndex: 0,
  modeIndex: 0,
  drumBeat: "rock",
  bassEnabled: true,
  bassWrapLow: 28,
  startBar: 1,
  autoWrite: true,
  blocks: [blk({ degreeIndex: 0 }), blk({ degreeIndex: 5 }), blk({ degreeIndex: 3 }), blk({ degreeIndex: 4, extensionIndex: 2 })],
  tracks: { chords: null, bass: null, drums: null },
};

export default defineSurface({
  params: {},
  banks: [],
  state: {
    song: state({ default: DEFAULT_SONG }),
  },
  windows: {
    editor: window({ title: "Chord Fiend (feel test)", width: 1100, height: 680, entry: "Editor" }),
  },
});
