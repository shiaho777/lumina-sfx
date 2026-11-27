import { editorSweep } from './_shared/editor-sweep.ts';

export default editorSweep(
  "tracing-paper-pull-away", "Tracing paper pull away",
  ["transition", "whoosh", "launch", "video", "paper", "dry", "thin", "zoom", "out", "retreat"],
  {"lowHz": 1020, "highHz": 4900, "grainHz": 90, "grainDepth": 0.34, "air": 0.075, "body": 0.98},
  {"duration": 0.48, "apex": 0.12, "direction": 0, "travel": 0, "reverse": true, "echo": 0.035},
);
