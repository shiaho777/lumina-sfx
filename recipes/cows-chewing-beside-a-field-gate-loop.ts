import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import chewing from './_recordings/isolated-chewing.ts';

export default {
  id: 'cows-chewing-beside-a-field-gate-loop', name: "Cows chewing beside a field gate loop", category: 'Animals',
  tags: ["cattle", "cow", "grazing", "herd", "loop"],
  loopable: true, durationSec: 4.5, mixRole: 'ambience', targetRmsDbfs: -29,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(chewing), isolation:'isolated', components:['grazing'],
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [chewing, 0.16, 1.61, 0.84, 1, 10500, 0, 0.001, 0.022],
      [chewing, 1.67, 1.21, 0.34, 1, 10500, 0, 0.001, 0.022],
      [chewing, 2.98, 1.38, 0.69, 1, 10500, 0, 0.001, 0.022],
    ]);
  },
} satisfies SoundRecipe;
