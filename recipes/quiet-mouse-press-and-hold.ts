import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-soft-switch.ts';

export default editorContact(
  "quiet-mouse-press-and-hold", "Silent mouse press, hold and release",
  ["device", "launch", "video", "mouse", "pointer", "damped", "hold", "drag", "drop"], 0.557, attack,
  { captured: true, pairedTakes: true, cutoffHz: 6100 },
  [
    {"at": 0, "weight": 1, "pitch": 0.989},
    {"at": 0.49, "weight": 0.55, "pitch": 1.014, "release": true}
  ],
);
