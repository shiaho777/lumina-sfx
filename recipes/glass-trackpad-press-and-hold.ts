import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-glass-trackpad.ts';

export default editorContact(
  "glass-trackpad-press-and-hold", "Glass trackpad press, hold and release",
  ["device", "launch", "video", "trackpad", "touch", "haptic", "laptop", "hold", "drag", "drop"], 0.557, attack,
  { captured: true, pairedTakes: true, cutoffHz: 10500 },
  [
    {"at": 0, "weight": 1, "pitch": 0.91},
    {"at": 0.49, "weight": 0.55, "pitch": 1.12, "release": true}
  ],
);
