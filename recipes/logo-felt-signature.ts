import type { SoundRecipe } from '../engine/types.ts';
import { interfaceFeedback } from './_shared/interface-feedback.ts';
import { seatedContact } from './_shared/screen-foley.ts';
import contact from './_recordings/isolated-key-office.ts';
import { mix } from '../engine/dsp.ts';

export default {
  id: 'logo-felt-signature',
  name: 'End card · felt signature',
  category: 'Footsteps & UI',
  tags: ['logo', 'sting', 'end', 'card', 'editorial', 'signature', 'felt'],
  mixRole: 'interface',
  isolation: 'isolated',
  recording: contact.credit,
  durationSec: 0.58,
  loopable: false,
  targetRmsDbfs: -27,
  params: { pressure: { label: 'Felt pressure', min: 0, max: 1, default: 0.5 } },
  render(ctx, { seed, params }) {
    const body = interfaceFeedback(ctx, params.pressure, [
      [0, 439, 0.081, 0.7, 'felt'],
      [0.008, 658, 0.054, 0.22, 'wood'],
    ]);
    mix(body, seatedContact(ctx, contact, seed, params.pressure, 390, 2600, 0.28), 0.17);
    return body;
  },
} satisfies SoundRecipe;
