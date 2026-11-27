import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import naturalRobin from './_recordings/isolated-robin-call.ts';

export default {
  id: 'robin-song', name: "Robin Song", category: 'Animals',
  tags: ["bird", "robin", "song", "garden"],
  loopable: false, durationSec: 1.72, mixRole: 'voice', targetRmsDbfs: -24,
  params: { pace: { label: 'Pace', min: 0, max: 1, default: 0.54 } },
  ...performanceCredits(naturalRobin),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.pace, [
      [naturalRobin, 0.0, 1.72, 1.0, 0.93 + 0.13 * params.pace, 10500, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
