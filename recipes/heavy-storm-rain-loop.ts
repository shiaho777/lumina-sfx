import type { SoundRecipe } from '../engine/types.ts';
import { independentRain } from './_shared/independent-rain.ts';
import drops from './_recordings/isolated-canopy-droplets.ts';

export default {
  id: 'heavy-storm-rain-loop', name: "Heavy Storm Rain", category: 'Weather & Ambience',
  tags: ["rain","storm","weather","downpour","loop"], loopable: true, sustainMode: 'evolving', durationSec: 7,
  params: { gusts: { label: 'Gusts', min: 0, max: 1, default: 0.74 } },
  soloQueries: ['heavy rain'], components: ['rain'], isolation: 'isolated',
  recording: drops.credit,
  render(ctx, {params}) {
    return independentRain(ctx, 0.61 + 0.38 * params.gusts, false);
  },
} satisfies SoundRecipe;
