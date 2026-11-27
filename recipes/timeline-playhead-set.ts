import { editorContact } from './_shared/editor-contact.ts';
import source from './_recordings/isolated-response-microclick.ts';

const contact = editorContact(
  'timeline-playhead-set', 'Timeline playhead set', ["ui", "timeline", "scrub", "frame", "playhead", "marker", "single"],
  0.132, source,
  { bodyHz: 470, decayMs: 5, cutoffHz: 3700, snap: 0.55, rattle: 0.01 },
  [{ at: 0, weight: 1, pitch: 1.1 }],
);
export default { ...contact, category: 'Sci-Fi & UI' as const, params: { pressure: { label: 'Pressure', min: 0, max: 1, default: 0.52 } }, targetRmsDbfs: -32 };
