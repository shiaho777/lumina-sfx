import type { SoundRecipe } from '../engine/types.ts';
import contact from './_recordings/isolated-response-rocker.ts';
import { interfaceFeedback } from './_shared/interface-feedback.ts';
import { mix } from '../engine/dsp.ts';
import { seatedContact } from './_shared/screen-foley.ts';

export default {
  id: 'mechanical-ui-click', name: "Mechanical UI Click", category: 'Footsteps & UI',
  tags: ["click","ui","switch","button","mechanical"],
  isolation: 'isolated', recording: contact.credit, mixRole: 'interface',
  loopable: false, durationSec: 0.18, targetRmsDbfs: -26,
  params: { snap: { label: 'Snap', min: 0, max: 1, default: 0.77 } },
  render(ctx, { seed, params }) {
    const out = seatedContact(ctx, contact, seed, params.snap, 660, 6800, 0.49);
    mix(out, interfaceFeedback(ctx, params.snap, [[0, 590, .014, .7, 'wood']]), .29);
    return out;
  },
} satisfies SoundRecipe;
