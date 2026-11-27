import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldCowGrass from './_recordings/isolated-chewing.ts';
import fieldCowChew from './_recordings/field-cow-chew.ts';
import naturalGrassDrag from './_recordings/natural-grass-drag.ts';

export default {
  id: 'cow-mouthful-of-pasture', name: "Cow mouthful of pasture", category: 'Animals',
  tags: ["cow", "cattle", "chew", "grazing"],
  loopable: false, durationSec: 2.79, mixRole: 'voice', targetRmsDbfs: -27,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldCowGrass, fieldCowChew, naturalGrassDrag),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldCowGrass, 0.0, 1.59, 0.83, 1, 10500, 0, 0.001, 0.022],
      [fieldCowChew, 1.18, 1.56, 0.8, 1, 10500, 0, 0.001, 0.022],
      [naturalGrassDrag, 0.31, 0.21, 0.07, 1, 10500, 0, 0.001, 0.022],
    ]);
  },
} satisfies SoundRecipe;
