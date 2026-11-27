import type { SoundRecipe } from '../engine/types.ts';
import { surfaceRain } from './_shared/weather-textures.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-on-tin-roof-loop", name: "Rain on a Tin Roof", category: 'Weather & Ambience',
  tags: ["rain","roof","metal-roof","indoors"], loopable: true, durationSec: 8,
  params: { downpour: { label: "Downpour", min: 0, max: 1, default: 0.72 } },
  render(ctx, { params }) {
    return surfaceRain(ctx, { duration: 8, material: 'roof', force: 0.48 + params.downpour * 0.26, density: 0.85, pace: 3 });
  },
} satisfies SoundRecipe;
