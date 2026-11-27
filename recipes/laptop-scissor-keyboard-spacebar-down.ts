import { editorContact } from './_shared/editor-contact.ts';
import capture from './_recordings/isolated-laptop-scissor-spacebar.ts';

export default editorContact(
  'laptop-scissor-keyboard-spacebar-down', 'Laptop scissor keyboard spacebar downstroke',
  ["keyboard", "key", "launch", "video", "space", "bar", "spacebar", "stabilizer", "single", "down", "press", "held", "laptop", "scissor", "normal"], 0.083, capture,
  { captured: true, pairedTakes: false, cutoffHz: 11800 },
  [{ at: 0, weight: 1, pitch: 1 }],
);
