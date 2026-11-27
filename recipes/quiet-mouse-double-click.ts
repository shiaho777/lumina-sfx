import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-soft-switch.ts';

export default editorContact(
  "quiet-mouse-double-click", "Silent mouse double click",
  ["device", "launch", "video", "mouse", "pointer", "damped", "double", "selection"], 0.29, attack,
  { captured: true, pairedTakes: true, cutoffHz: 6100 },
  [
    {"at": 0, "weight": 1, "pitch": 1},
    {"at": 0.064, "weight": 0.27, "pitch": 1.012, "release": true},
    {"at": 0.158, "weight": 0.86, "pitch": 1.005},
    {"at": 0.223, "weight": 0.25, "pitch": 1.011, "release": true}
  ],
);
