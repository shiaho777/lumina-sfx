import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-wind-fabric.ts';
import contact from './_recordings/isolated-wooden-chest-latch-release.ts';
import { shapedPass, seatedContact, screenAir } from './_shared/screen-foley.ts';
import { layer, mix } from '../engine/dsp.ts';

export default {
  id: "portal-snap-closed", name: "Portal Snap Closed", category: "Sci-Fi & UI",
  tags: ["portal", "close", "warp", "spell", 'energy', 'fantasy'],
  isolation: 'isolated',
  recording: texture.credit, additionalRecordings: [contact.credit],
  loopable: false, durationSec: 0.76, targetRmsDbfs: -22,
  params: { shimmer: { label: "Shimmer", min: 0, max: 1, default: 0.55 } },
  render(ctx, { seed, params }) {
    const amount = params.shimmer;
    const out = shapedPass(ctx, texture, seed, amount, .25, 3600, .73);
    const air = screenAir(ctx, seed, amount, .46, 540, 4200, true);
    mix(out, air, .40);
    layer(ctx, out, .37, .16, part => seatedContact(part, contact, seed, amount, 340, 3000, .64), .33);
    return out;
  },
} satisfies SoundRecipe;
