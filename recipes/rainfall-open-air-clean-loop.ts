import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-garden-shower.ts';

export default {
  soloQueries: ["rain", "rainfall", "steady rain", "rain shower"],
  id: 'rainfall-open-air-clean-loop',
  name: 'Open-air rainfall · isolated steady shower',
  category: 'Weather & Ambience',
  tags: ['rain', 'storm', 'loop', 'rainfall', 'open', 'droplets', 'steady', 'heavy'],
  components: ['rain'],
  isolation: 'isolated',
  mixRole: 'ambience',
  recording: rain.credit,
  loopable: true, sustainMode: 'evolving',
  durationSec: 8.6,
  targetRmsDbfs: -24,
  params: { intensity: { label: 'Rain intensity', min: 0, max: 1, default: 0.56 } },
  render(ctx, { params, seed }) {
    // Preserve each recorded run of drops. Intensity changes their weight and brightness.
    return sustain(ctx, rain, seed, .92 + .15 * params.intensity, 4200 + 6200 * params.intensity);
  },
} satisfies SoundRecipe;
