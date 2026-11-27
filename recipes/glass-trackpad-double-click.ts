import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-glass-trackpad.ts';

export default editorContact(
  "glass-trackpad-double-click", "Glass trackpad double click",
  ["device", "launch", "video", "trackpad", "touch", "haptic", "laptop", "double", "selection"], 0.29, attack,
  { captured: true, pairedTakes: true, cutoffHz: 10500 },
  [
    {"at": 0, "weight": 1, "pitch": 1},
    {"at": 0.064, "weight": 0.27, "pitch": 1.1, "release": true},
    {"at": 0.158, "weight": 0.86, "pitch": 1.04},
    {"at": 0.223, "weight": 0.25, "pitch": 1.09, "release": true}
  ],
);
