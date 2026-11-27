import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-glass-trackpad.ts';

export default editorContact(
  "glass-trackpad-press", "Glass trackpad single press",
  ["device", "launch", "video", "trackpad", "touch", "haptic", "laptop", "single", "click", "down"], 0.067, attack,
  { captured: true, pairedTakes: true, cutoffHz: 10500 },
  [
    {"at": 0, "weight": 1, "pitch": 1}
  ],
);
