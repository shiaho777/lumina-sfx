import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import waves from './_recordings/isolated-breaking-shore.ts';

export default {
  id: 'ocean-shore-break-loop',
  name: 'Ocean surf · waves breaking on shore',
  category: 'Water & Fire',
  tags: ['sea', 'ocean', 'surf', 'wave', 'waves', 'breaking', 'breakers', 'shore', 'beach', 'foam', 'wash', 'water', 'receding'],
  components: ['breaking surf'],
  contains: ['shore wave rises, breaks and recedes'],
  perspective: 'stationary shoreline',
  isolation: 'isolated',
  loopable: true,
  sustainMode: 'evolving',
  durationSec: 8.5,
  targetRmsDbfs: -28,
  mixRole: 'ambience',
  recording: waves.credit,
  params: { pace: { label: 'Wave pace', min: 0, max: 1, default: 0.45 } },
  render(ctx, { seed, params }) {
    return sustain(ctx, waves, seed, 0.87 + 0.22 * params.pace, 11000);
  },
} satisfies SoundRecipe;
