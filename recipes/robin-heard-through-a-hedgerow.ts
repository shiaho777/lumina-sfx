import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import dryVineBrush from './_recordings/dry-vine-brush.ts';
import naturalRobin from './_recordings/isolated-robin-call.ts';

export default {
  id: 'robin-heard-through-a-hedgerow', name: "Robin heard through a hedgerow", category: 'Animals',
  tags: ["robin", "garden", "brush", "field"],
  loopable: false, durationSec: 2.451, mixRole: 'voice', targetRmsDbfs: -27,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(dryVineBrush, naturalRobin),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [dryVineBrush, 0.0, 0.28, 0.31, 1, 10500, 0.020, 0.001, 0.022],
      [naturalRobin, 0.14, 2.12, 0.87, 1.0, 6500.0, 0, 0.001, 0.022],
    ], { taps: [0.073, 0.141], send: 0.13, dampingHz: 2100 });
  },
} satisfies SoundRecipe;
