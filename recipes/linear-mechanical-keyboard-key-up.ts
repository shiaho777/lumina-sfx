import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-linear-row-keys.ts';

export default editorContact(
  "linear-mechanical-keyboard-key-up", "Linear mechanical keyboard letter key release",
  ["keyboard", "key", "launch", "video", "mechanical", "smooth", "single", "lift", "release"], 0.084, attack,
  { captured: true, pairedTakes: true, cutoffHz: 11200 },
  [
    {"at": 0, "weight": 0.63, "pitch": 1.017, "release": true}
  ],
);
