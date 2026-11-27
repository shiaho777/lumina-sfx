import { editorContact } from './_shared/editor-contact.ts';
import attack from './_recordings/isolated-key-office.ts';

export default editorContact(
  'laptop-scissor-keyboard-shortcut',
  'Laptop scissor keyboard modifier and shortcut',
  ['keyboard', 'key', 'launch', 'video', 'normal', 'notebook', 'low-profile', 'chord', 'hotkey', 'shortcut'],
  0.278,
  attack,
  { bodyHz: 1050, decayMs: 5, cutoffHz: 5600, snap: 0.87, rattle: 0.016 },
  [
    { at: 0, weight: 0.56, pitch: 0.96 },
    { at: 0.047, weight: 0.88, pitch: 1.02 },
    { at: 0.122, weight: 0.13, pitch: 1.1, release: true },
    { at: 0.139, weight: 0.105, pitch: 0.83, release: true },
  ],
);
