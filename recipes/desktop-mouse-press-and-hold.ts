import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-desktop-switch.ts';

export default editorContact(
  "desktop-mouse-press-and-hold", "Desktop mouse press, hold and release",
  ["device", "launch", "video", "mouse", "pointer", "microswitch", "hold", "drag", "drop"], 0.557, attack,
  { captured: true, pairedTakes: true, cutoffHz: 8100 },
  [
    {"at": 0, "weight": 1, "pitch": 0.989},
    {"at": 0.49, "weight": 0.55, "pitch": 1.014, "release": true}
  ],
);
