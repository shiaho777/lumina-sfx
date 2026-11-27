import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-linear-row-keys.ts';

export default editorContact(
  "linear-mechanical-keyboard-shortcut", "Linear mechanical keyboard modifier and shortcut",
  ["keyboard", "key", "launch", "video", "mechanical", "smooth", "chord", "hotkey", "shortcut"], 0.295, attack,
  { captured: true, pairedTakes: true, cutoffHz: 11200 },
  [
    {"at": 0, "weight": 0.64, "pitch": 0.971},
    {"at": 0.084, "weight": 1, "pitch": 1.014},
    {"at": 0.177, "weight": 0.26, "pitch": 1.012, "release": true},
    {"at": 0.211, "weight": 0.3, "pitch": 0.98, "release": true}
  ],
);
