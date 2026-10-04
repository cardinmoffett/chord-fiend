import { CHAIN_IN, CHAIN_OUT, DEVICE_IN } from "@m4l-jweb/bridge";

/** Wrapper -> page. The cf_ replies go to the editor window, which asked. */
export const IN = {
  ...DEVICE_IN,
  ...CHAIN_IN,
  cf_tracks: "cf_tracks",
  cf_result: "cf_result",
} as const;

/** Page -> wrapper. The cf_ requests come from the editor window (wrapper/device.ts). */
export const OUT = {
  ...CHAIN_OUT,
  ui_ready: "ui_ready",
  cf_tracks: "cf_tracks",
  cf_write: "cf_write",
  cf_clear: "cf_clear",
  cf_loop: "cf_loop",
  cf_play: "cf_play",
  cf_stop: "cf_stop",
} as const;
