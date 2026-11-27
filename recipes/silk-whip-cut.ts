import { editorSweep } from './_shared/editor-sweep.ts';

export default editorSweep(
  "silk-whip-cut", "Silk whip cut",
  ["transition", "whoosh", "launch", "video", "soft", "fabric", "satin", "fast", "cut", "whip", "pan"],
  {"lowHz": 490, "highHz": 3100, "grainHz": 14, "grainDepth": 0.11, "air": 0.016, "body": 2.55},
  {"duration": 0.12, "apex": 0.50, "direction": 1, "travel": 0.9, "reverse": true, "echo": 0},
);
