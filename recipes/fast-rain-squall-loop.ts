import type { SoundRecipe } from '../engine/types.ts';
import { surfaceRain } from './_shared/weather-textures.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "fast-rain-squall-loop", name: "Fast Rain Squall", category: 'Weather & Ambience',
  tags: ["rain","downpour","squall","fast"], loopable: true, durationSec: 6.8,
  params: { gusts: { label: "Gusts", min: 0, max: 1, default: 0.74 } },
  render(ctx, { params }) {
    return surfaceRain(ctx, { duration: 6.8, material: 'open', force: 0.62 + params.gusts * 0.25, density: 0.94, pace: 6 });
  },
} satisfies SoundRecipe;
