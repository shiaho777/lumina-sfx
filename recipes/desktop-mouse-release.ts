import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-desktop-switch.ts';

export default editorContact(
  "desktop-mouse-release", "Desktop mouse release",
  ["device", "launch", "video", "mouse", "pointer", "microswitch", "lift", "up"], 0.067, attack,
  { captured: true, pairedTakes: true, cutoffHz: 8100 },
  [
    {"at": 0, "weight": 0.61, "pitch": 1.019, "release": true}
  ],
);
