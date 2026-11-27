import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-soft-switch.ts';

export default editorContact(
  "quiet-mouse-release", "Silent mouse release",
  ["device", "launch", "video", "mouse", "pointer", "damped", "lift", "up"], 0.067, attack,
  { captured: true, pairedTakes: true, cutoffHz: 6100 },
  [
    {"at": 0, "weight": 0.61, "pitch": 1.019, "release": true}
  ],
);
