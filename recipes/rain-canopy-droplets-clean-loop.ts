import type { SoundRecipe } from '../engine/types.ts';
import { independentRain } from './_shared/independent-rain.ts';
import drops from './_recordings/isolated-canopy-droplets.ts';

export default {
  id: 'rain-canopy-droplets-clean-loop',
  name: 'Rain on canopy · isolated droplets',
  category: 'Weather & Ambience',
  tags: ['rain', 'storm', 'loop', 'rainfall', 'canopy', 'droplets', 'steady', 'heavy'],
  components: ['rain'],
  isolation: 'isolated',
  mixRole: 'ambience',
  recording: drops.credit,
  loopable: true, sustainMode: 'evolving',
  durationSec: 8.6,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Rain intensity', min: 0, max: 1, default: 0.56 } },
  render(ctx, { params }) {
    return independentRain(ctx, params.intensity, true);
  },
} satisfies SoundRecipe;
