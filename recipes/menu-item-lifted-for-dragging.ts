import { editorContact } from './_shared/editor-contact.ts';
import source from './_recordings/isolated-key-office.ts';

const contact = editorContact(
  'menu-item-lifted-for-dragging', 'Menu item lifted for dragging', ["ui", "menu", "drag", "handle", "grab", "pickup", "lift", "soft"],
  0.205, source,
  { bodyHz: 430, decayMs: 9, cutoffHz: 3450, snap: 0.51, rattle: 0.01 },
  [{ at: 0, weight: 1, pitch: 0.89, release: true }],
);
export default { ...contact, category: 'Sci-Fi & UI' as const, params: { pressure: { label: 'Pressure', min: 0, max: 1, default: 0.52 } }, targetRmsDbfs: -29 };
