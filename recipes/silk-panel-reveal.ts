import { editorSweep } from './_shared/editor-sweep.ts';

export default editorSweep(
  "silk-panel-reveal", "Silk panel reveal",
  ["transition", "whoosh", "launch", "video", "soft", "fabric", "satin", "reveal", "panel", "entrance"],
  {"lowHz": 330, "highHz": 2050, "grainHz": 7, "grainDepth": 0.035, "air": 0.008, "body": 2.1},
  {"duration": 0.38, "apex": 0.48, "direction": 0, "travel": 0, "reverse": false, "echo": 0.04},
);
