import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import catMeow from './_recordings/isolated-cat-call.ts';
import jacketMovementRustle from './_recordings/jacket-movement-rustle.ts';
import naturalPurr from './_recordings/natural-purr.ts';

export default {
  id: 'cat-settles-into-a-lap', name: "Cat settles into a lap", category: 'Animals',
  tags: ["cat", "purr", "meow", "lap", "companion"],
  loopable: false, durationSec: 2.84, mixRole: 'voice', targetRmsDbfs: -28,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(catMeow, jacketMovementRustle, naturalPurr),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [catMeow, 0.0, 0.7, 0.61, 1, 10500, 0, 0.001, 0.022],
      [jacketMovementRustle, 0.46, 0.24, 0.18, 1, 10500, 0, 0.001, 0.022],
      [naturalPurr, 0.6, 2.19, 0.9, 1, 10500, 0, 0.001, 0.022],
    ]);
  },
} satisfies SoundRecipe;
