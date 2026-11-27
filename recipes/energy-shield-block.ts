import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-tire-scrub.ts';
import contact from './_recordings/isolated-wooden-chest-latch-release.ts';
import { shapedPass, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "energy-shield-block", name: "Energy Shield Block", category: "Sci-Fi & UI",
  tags: ["shield", "block", "deflect", "energy", 'sci-fi', 'impact'],
  isolation: 'isolated',
  recording: texture.credit, additionalRecordings: [contact.credit],
  loopable: false, durationSec: 0.54, targetRmsDbfs: -21,
  params: { edge: { label: "Edge", min: 0, max: 1, default: 0.53 } },
  render(ctx, { seed, params }) {
    const amount = params.edge;
    const out = shapedPass(ctx, texture, seed, amount, .12, 2900, .81);
    layer(ctx, out, 0, .14, part => seatedContact(part, contact, seed, amount, 420, 4300, .46), .85);
    return out;
  },
} satisfies SoundRecipe;
