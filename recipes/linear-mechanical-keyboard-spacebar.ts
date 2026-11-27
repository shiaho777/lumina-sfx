import { editorContact } from './_shared/editor-contact.ts';
import capture from './_recordings/isolated-linear-mechanical-spacebar.ts';

export default editorContact(
  'linear-mechanical-keyboard-spacebar', 'Linear mechanical keyboard spacebar tap',
  ["keyboard", "key", "launch", "video", "space", "bar", "spacebar", "stabilizer", "single", "tap", "mechanical", "linear"], 0.169, capture,
  { captured: true, pairedTakes: false, cutoffHz: 11800 },
  [{ at: 0, weight: 1, pitch: 1 }],
);
