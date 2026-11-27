import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-rail-bend.ts';
import contact from './_recordings/isolated-wooden-chest-latch-release.ts';
import { shapedPass, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "portal-unfold", name: "Portal Unfold", category: "Sci-Fi & UI",
  tags: ["portal", "unfold", "opening", "spell", "space", 'energy', 'fantasy'],
  isolation: 'isolated',
  recording: texture.credit, additionalRecordings: [contact.credit],
  loopable: false, durationSec: 1.76, targetRmsDbfs: -22,
  params: { shimmer: { label: "Shimmer", min: 0, max: 1, default: 0.55 } },
  render(ctx, { seed, params }) {
    const amount = params.shimmer;
    const out = shapedPass(ctx, texture, seed, amount, .58, 2450, .73);
    layer(ctx, out, 0, .20, part => seatedContact(part, contact, seed, amount, 220, 2000, .46), .24);
    return out;
  },
} satisfies SoundRecipe;
