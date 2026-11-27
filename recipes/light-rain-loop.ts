import type { SoundRecipe } from '../engine/types.ts';
import { independentRain } from './_shared/independent-rain.ts';
import drops from './_recordings/isolated-canopy-droplets.ts';

export default {
  id: 'light-rain-loop', name: "Light Rain", category: 'Weather & Ambience',
  tags: ["rain","weather","drizzle","loop"], loopable: true, sustainMode: 'evolving', durationSec: 6,
  mixRole: 'ambience', targetRmsDbfs: -34,
  params: { drops: { label: 'Drops', min: 0, max: 1, default: 0.62 } },
  soloQueries: ['light rain'], components: ['rain'], isolation: 'isolated',
  recording: drops.credit,
  render(ctx, {params}) {
    return independentRain(ctx, 0.16 + 0.38 * params.drops, false, true);
  },
} satisfies SoundRecipe;
