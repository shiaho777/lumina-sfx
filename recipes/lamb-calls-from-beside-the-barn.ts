import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldLambCall from './_recordings/isolated-lamb-call.ts';

export default {
  id: 'lamb-calls-from-beside-the-barn', name: "Lamb calls from beside the barn", category: 'Animals',
  tags: ["sheep", "lamb", "distant", "response"],
  loopable: false, durationSec: 2.684, mixRole: 'voice', targetRmsDbfs: -25,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldLambCall),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldLambCall, 0.0, 1.15, 0.87, 1, 10500, 0, 0.001, 0.022],
      [fieldLambCall, 1.53, 1.04, 0.47, 0.978, 5700.0, 0, 0.001, 0.022],
    ], { taps: [0.024, 0.064], send: 0.125, dampingHz: 3300 });
  },
} satisfies SoundRecipe;
