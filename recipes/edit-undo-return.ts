import { editorContact } from './_shared/editor-contact.ts';
import source from './_recordings/isolated-response-rocker.ts';

const contact = editorContact(
  'edit-undo-return',
  'Undo · felt key return',
  ['ui', 'menu', 'history', 'undo', 'reverse', 'return', 'soft', 'felt'],
  0.097,
  source,
  { bodyHz: 340, decayMs: 8, cutoffHz: 3200, snap: 0.5, rattle: 0.025 },
  [{ at: 0, weight: 1, pitch: 0.85, release: true }],
);
export default { ...contact, targetRmsDbfs: -29 };
