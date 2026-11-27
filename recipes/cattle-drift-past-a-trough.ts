import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldFarmCow from './_recordings/field-farm-cow.ts';
import fieldCowGrass from './_recordings/isolated-chewing.ts';
import cowMoo from './_recordings/cow-moo.ts';
import naturalMud from './_recordings/natural-mud.ts';

export default {
  id: 'cattle-drift-past-a-trough', name: "Cattle drift past a trough", category: 'Animals',
  tags: ["cow", "cattle", "herd", "pasture", "movement"],
  loopable: false, durationSec: 3.152, mixRole: 'voice', targetRmsDbfs: -24,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldFarmCow, fieldCowGrass, cowMoo, naturalMud),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldFarmCow, 0.0, 1.31, 0.52, 1, 10500, 0, 0.001, 0.022],
      [fieldCowGrass, 0.58, 1.42, 0.64, 1, 10500, 0, 0.001, 0.022],
      [cowMoo, 1.2, 1.8, 0.78, 1, 10500, 0, 0.001, 0.022],
      [naturalMud, 1.73, 0.34, 0.18, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
