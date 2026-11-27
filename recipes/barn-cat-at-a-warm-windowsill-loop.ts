import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import naturalPurr from './_recordings/natural-purr.ts';
import jacketMovementRustle from './_recordings/jacket-movement-rustle.ts';

export default {
  id: 'barn-cat-at-a-warm-windowsill-loop', name: "Barn cat at a warm windowsill loop", category: 'Animals',
  tags: ["cat", "purr", "pet", "quiet", "resting", "loop"],
  loopable: true, durationSec: 4.5, mixRole: 'ambience', targetRmsDbfs: -31,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(naturalPurr, jacketMovementRustle),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [naturalPurr, 0.0, 2.4, 1.0, 1, 10500, 0, 0.001, 0.022],
      [naturalPurr, 2.03, 2.35, 0.81, 1, 10500, 0, 0.001, 0.022],
      [jacketMovementRustle, 3.78, 0.21, 0.08, 1, 10500, 0, 0.001, 0.022],
    ]);
  },
} satisfies SoundRecipe;
