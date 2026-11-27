import { editorContact } from './_shared/editor-contact.ts';
import source from './_recordings/isolated-response-rocker.ts';

const contact = editorContact(
  'edit-redo-seat',
  'Redo · forward index detent',
  ['ui', 'menu', 'history', 'redo', 'forward', 'detent', 'crisp'],
  0.115,
  source,
  { bodyHz: 690, decayMs: 11, cutoffHz: 4750, snap: 0.69, rattle: 0.018 },
  [{ at: 0, weight: 1, pitch: 1.04 }],
);
export default { ...contact, targetRmsDbfs: -28 };
