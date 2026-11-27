import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import jacketMovementRustle from './_recordings/jacket-movement-rustle.ts';
import naturalPurr from './_recordings/natural-purr.ts';
import catMeow from './_recordings/isolated-cat-call.ts';

export default {
  id: 'cat-stirs-beside-a-sleeping-player', name: "Cat stirs beside a sleeping player", category: 'Animals',
  tags: ["cat", "purring", "cloth", "companion", "idle"],
  loopable: false, durationSec: 3.052, mixRole: 'voice', targetRmsDbfs: -31,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(jacketMovementRustle, naturalPurr, catMeow),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [jacketMovementRustle, 0.0, 0.29, 0.14, 1, 10500, 0, 0.001, 0.022],
      [naturalPurr, 0.12, 2.25, 0.94, 1, 10500, 0, 0.001, 0.022],
      [catMeow, 2.25, 0.72, 0.34, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.012, 0.032], send: 0.075, dampingHz: 4400 });
  },
} satisfies SoundRecipe;
