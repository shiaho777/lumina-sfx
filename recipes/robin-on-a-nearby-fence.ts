import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import naturalRobin from './_recordings/isolated-robin-call.ts';

export default {
  isolation: 'isolated',
  id: 'robin-on-a-nearby-fence', name: "Robin on a nearby fence", category: 'Animals',
  tags: ["robin", "songbird", "close", "call"],
  loopable: false, durationSec: 3.742, mixRole: 'voice', targetRmsDbfs: -25,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(naturalRobin),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [naturalRobin, 0.0, 1.74, 0.91, 1, 10500, 0, 0.001, 0.022],
      [naturalRobin, 2.01, 1.58, 0.68, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
