import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import goatDoubleBleat from './_recordings/goat-double-bleat.ts';
import fieldGoatYoung from './_recordings/isolated-young-goat.ts';

export default {
  id: 'goat-calls-across-the-pen', name: "Goat calls across the pen", category: 'Animals',
  tags: ["goat", "nanny", "kid", "bleat", "answer"],
  loopable: false, durationSec: 2.922, mixRole: 'voice', targetRmsDbfs: -24,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(goatDoubleBleat, fieldGoatYoung),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [goatDoubleBleat, 0.0, 1.71, 0.88, 1, 10500, 0, 0.001, 0.022],
      [fieldGoatYoung, 1.93, 0.84, 0.56, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
