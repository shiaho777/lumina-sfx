import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-glass-trackpad.ts';

export default editorContact(
  "glass-trackpad-release", "Glass trackpad release",
  ["device", "launch", "video", "trackpad", "touch", "haptic", "laptop", "lift", "up"], 0.067, attack,
  { captured: true, pairedTakes: true, cutoffHz: 10500 },
  [
    {"at": 0, "weight": 0.61, "pitch": 1.16, "release": true}
  ],
);
