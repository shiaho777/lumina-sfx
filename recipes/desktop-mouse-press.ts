import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-desktop-switch.ts';

export default editorContact(
  "desktop-mouse-press", "Desktop mouse single press",
  ["device", "launch", "video", "mouse", "pointer", "microswitch", "single", "click", "down"], 0.067, attack,
  { captured: true, pairedTakes: true, cutoffHz: 8100 },
  [
    {"at": 0, "weight": 1, "pitch": 1}
  ],
);
