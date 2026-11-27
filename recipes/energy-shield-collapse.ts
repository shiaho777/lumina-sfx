import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-rail-bend.ts';
import contact from './_recordings/isolated-physical-light-switch.ts';
import { shapedPass, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "energy-shield-collapse", name: "Energy Shield Collapse", category: "Sci-Fi & UI",
  tags: ["shield", "barrier", "failure", "energy", 'sci-fi', 'collapse'],
  isolation: 'isolated',
  recording: texture.credit, additionalRecordings: [contact.credit],
  loopable: false, durationSec: 0.73, targetRmsDbfs: -21,
  params: { edge: { label: "Edge", min: 0, max: 1, default: 0.53 } },
  render(ctx, { seed, params }) {
    const amount = params.edge;
    const out = shapedPass(ctx, texture, seed, amount, .18, 1950, 1.05);
    layer(ctx, out, 0, .11, part => seatedContact(part, contact, seed, amount, 290, 3300, .46), .39);
    return out;
  },
} satisfies SoundRecipe;
