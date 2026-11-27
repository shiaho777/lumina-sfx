import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-soft-switch.ts';

export default editorContact(
  "quiet-mouse-three-taps", "Silent mouse three deliberate taps",
  ["device", "launch", "video", "mouse", "pointer", "damped", "triple", "repeat"], 0.39, attack,
  { captured: true, pairedTakes: true, cutoffHz: 6100 },
  [
    {"at": 0, "weight": 0.8, "pitch": 1.004},
    {"at": 0.137, "weight": 1, "pitch": 0.995},
    {"at": 0.323, "weight": 0.89, "pitch": 1.007}
  ],
);
