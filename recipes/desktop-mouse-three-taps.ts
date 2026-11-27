import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-desktop-switch.ts';

export default editorContact(
  "desktop-mouse-three-taps", "Desktop mouse three deliberate taps",
  ["device", "launch", "video", "mouse", "pointer", "microswitch", "triple", "repeat"], 0.39, attack,
  { captured: true, pairedTakes: true, cutoffHz: 8100 },
  [
    {"at": 0, "weight": 0.8, "pitch": 1.004},
    {"at": 0.137, "weight": 1, "pitch": 0.995},
    {"at": 0.323, "weight": 0.89, "pitch": 1.007}
  ],
);
