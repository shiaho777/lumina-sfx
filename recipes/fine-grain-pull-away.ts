import { editorSweep } from './_shared/editor-sweep.ts';

export default editorSweep(
  "fine-grain-pull-away", "Fine grain pull away",
  ["transition", "whoosh", "launch", "video", "sand", "textured", "grit", "zoom", "out", "retreat"],
  {"lowHz": 820, "highHz": 4650, "grainHz": 143, "grainDepth": 0.43, "air": 0.11, "body": 1.22},
  {"duration": 0.48, "apex": 0.12, "direction": 0, "travel": 0, "reverse": true, "echo": 0.035},
);
