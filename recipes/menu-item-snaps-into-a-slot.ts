import { editorContact } from './_shared/editor-contact.ts';
import source from './_recordings/isolated-response-button.ts';

const contact = editorContact(
  'menu-item-snaps-into-a-slot', 'Menu item snaps into a slot', ["ui", "menu", "slot", "snap", "grid", "align", "seat", "card", "magnet"],
  0.204, source,
  { bodyHz: 520, decayMs: 14, cutoffHz: 4900, snap: 0.75, rattle: 0.04 },
  [{ at: 0, weight: 1, pitch: 0.93 }],
);
export default { ...contact, category: 'Sci-Fi & UI' as const, params: { pressure: { label: 'Pressure', min: 0, max: 1, default: 0.52 } }, targetRmsDbfs: -26 };
