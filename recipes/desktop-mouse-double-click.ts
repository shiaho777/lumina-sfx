import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-mx-desktop-switch.ts';

export default editorContact(
  "desktop-mouse-double-click", "Desktop mouse double click",
  ["device", "launch", "video", "mouse", "pointer", "microswitch", "double", "selection"], 0.29, attack,
  { captured: true, pairedTakes: true, cutoffHz: 8100 },
  [
    {"at": 0, "weight": 1, "pitch": 1},
    {"at": 0.064, "weight": 0.27, "pitch": 1.012, "release": true},
    {"at": 0.158, "weight": 0.86, "pitch": 1.005},
    {"at": 0.223, "weight": 0.25, "pitch": 1.011, "release": true}
  ],
);
