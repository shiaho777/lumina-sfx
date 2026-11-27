import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-linear-row-keys.ts';

export default editorContact(
  "linear-mechanical-keyboard-typed-word", "Linear mechanical keyboard four-letter word",
  ["keyboard", "key", "launch", "video", "mechanical", "smooth", "typing", "text", "word", "burst"], 0.412, attack,
  { captured: true, pairedTakes: true, cutoffHz: 11200 },
  [
    {"at": 0, "weight": 0.88, "pitch": 1.007},
    {"at": 0.106, "weight": 1, "pitch": 0.992},
    {"at": 0.184, "weight": 0.76, "pitch": 1.017},
    {"at": 0.328, "weight": 0.94, "pitch": 0.996}
  ],
);
