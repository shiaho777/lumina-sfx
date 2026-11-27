import { editorSweep } from './_shared/editor-sweep.ts';

export default editorSweep(
  "celluloid-whip-cut", "Celluloid whip cut",
  ["transition", "whoosh", "launch", "video", "film", "strip", "flutter", "energetic", "high energy", "fast", "cut", "whip", "pan"],
  {"lowHz": 280, "highHz": 4810, "grainHz": 17, "grainDepth": 0.26, "air": 0.033, "body": 2.35},
  {"duration": 0.29, "apex": 0.53, "direction": 1, "travel": 0.9, "reverse": true, "echo": 0},
);
