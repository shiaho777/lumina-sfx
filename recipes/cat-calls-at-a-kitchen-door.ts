import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import catMeow from './_recordings/isolated-cat-call.ts';

export default {
  id: 'cat-calls-at-a-kitchen-door', name: "Cat calls at a kitchen door", category: 'Animals',
  tags: ["cat", "meow", "waiting", "indoors"],
  loopable: false, durationSec: 2.142, mixRole: 'voice', targetRmsDbfs: -25,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(catMeow),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [catMeow, 0.0, 0.78, 0.95, 1, 10500, 0, 0.001, 0.022],
      [catMeow, 1.29, 0.77, 0.72, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.012, 0.032], send: 0.075, dampingHz: 4400 });
  },
} satisfies SoundRecipe;
