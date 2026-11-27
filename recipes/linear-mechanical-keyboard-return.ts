import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-wide-return-travel.ts';

export default editorContact(
  "linear-mechanical-keyboard-return", "Linear mechanical keyboard Return key",
  ["keyboard", "key", "launch", "video", "mechanical", "smooth", "enter", "submit"], 0.157, attack,
  { captured: true, pairedTakes: true, cutoffHz: 11500 },
  [
    {"at": 0, "weight": 1, "pitch": 1},
    {"at": 0.073, "weight": 0.34, "pitch": 0.94, "release": true}
  ],
);
