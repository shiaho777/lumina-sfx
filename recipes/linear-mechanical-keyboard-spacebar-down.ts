import { editorContact } from './_shared/editor-contact.ts';
import capture from './_recordings/isolated-linear-mechanical-spacebar.ts';

export default editorContact(
  'linear-mechanical-keyboard-spacebar-down', 'Linear mechanical keyboard spacebar downstroke',
  ["keyboard", "key", "launch", "video", "space", "bar", "spacebar", "stabilizer", "single", "down", "press", "held", "mechanical", "linear"], 0.106, capture,
  { captured: true, pairedTakes: false, cutoffHz: 11800 },
  [{ at: 0, weight: 1, pitch: 1 }],
);
