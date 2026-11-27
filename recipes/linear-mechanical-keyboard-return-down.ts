import { editorContact } from './_shared/editor-contact.ts';
import key from './_recordings/isolated-wide-return-travel.ts';

export default editorContact(
  'linear-mechanical-keyboard-return-down', 'Mechanical keyboard Return key down',
  ['keyboard', 'mechanical', 'return', 'enter', 'key', 'single', 'press', 'down', 'wide', 'held', 'recorded', 'hardware', 'launch', 'video'],
  0.10, key, { captured: true, pairedTakes: true, cutoffHz: 11500 },
  [{ at: 0, pitch: 1, weight: 1 }],
);
