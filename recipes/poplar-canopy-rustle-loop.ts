import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import leaves from './_recordings/isolated-poplar-leaves.ts';

export default {
  id: 'poplar-canopy-rustle-loop',
  name: 'Breeze in poplar leaves',
  category: 'Weather & Ambience',
  tags: ['poplar', 'tree', 'leaves', 'leaf', 'broadleaf', 'foliage', 'rustle', 'wind', 'breeze', 'gentle'],
  contains: ['wind rustling the broad leaves of a poplar'],
  components: ['leaf rustle'],
  perspective: 'close tree canopy',
  recording: leaves.credit,
  isolation: 'isolated',
  loopable: true,
  sustainMode: 'evolving',
  durationSec: 6.4,
  targetRmsDbfs: -30,
  mixRole: 'ambience',
  params: { breeze: { label: 'Breeze strength', min: 0, max: 1, default: 0.38 } },
  render(ctx, { seed, params }) {
    return sustain(ctx, leaves, seed, 0.93 + 0.13 * params.breeze, 7700 + 2400 * params.breeze);
  },
} satisfies SoundRecipe;
