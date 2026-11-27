import { editorContact } from './_shared/editor-contact.ts';
import capture from './_recordings/isolated-laptop-scissor-spacebar.ts';

export default editorContact(
  'laptop-scissor-keyboard-spacebar', 'Laptop scissor keyboard spacebar tap',
  ["keyboard", "key", "launch", "video", "space", "bar", "spacebar", "stabilizer", "single", "tap", "laptop", "scissor", "normal"], 0.152, capture,
  { captured: true, pairedTakes: false, cutoffHz: 11800 },
  [{ at: 0, weight: 1, pitch: 1 }],
);
