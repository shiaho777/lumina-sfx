import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-linear-row-keys.ts';

export default editorContact(
  "linear-mechanical-keyboard-command-line", "Linear mechanical keyboard command then Return",
  ["keyboard", "key", "launch", "video", "mechanical", "smooth", "typing", "terminal", "command", "phrase"], 0.837, attack,
  { captured: true, pairedTakes: true, cutoffHz: 11200 },
  [
    {"at": 0, "weight": 0.73, "pitch": 1.01},
    {"at": 0.088, "weight": 0.94, "pitch": 0.988},
    {"at": 0.197, "weight": 0.71, "pitch": 1.016},
    {"at": 0.276, "weight": 0.82, "pitch": 1.004},
    {"at": 0.406, "weight": 0.8, "pitch": 0.994},
    {"at": 0.669, "weight": 1, "pitch": 0.966},
    {"at": 0.753, "weight": 0.32, "pitch": 0.99, "release": true}
  ],
);
