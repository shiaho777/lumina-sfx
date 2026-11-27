import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-soft-switch.ts';

export default editorContact(
  "quiet-mouse-press", "Silent mouse single press",
  ["device", "launch", "video", "mouse", "pointer", "damped", "single", "click", "down"], 0.067, attack,
  { captured: true, pairedTakes: true, cutoffHz: 6100 },
  [
    {"at": 0, "weight": 1, "pitch": 1}
  ],
);
