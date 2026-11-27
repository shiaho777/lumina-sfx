import type { SoundRecipe } from '../engine/types.ts';
import { surfaceRain } from './_shared/weather-textures.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "fine-drizzle-loop", name: "Fine Mist Drizzle", category: 'Weather & Ambience',
  tags: ["rain","drizzle","gentle","slow"], loopable: true, durationSec: 7.5,
  params: { mist: { label: "Mist", min: 0, max: 1, default: 0.56 } },
  targetRmsDbfs: -25,
  render(ctx, { params }) {
    return surfaceRain(ctx, { duration: 7.5, material: 'mist', force: 0.17, density: 0.20 + params.mist * 0.30, pace: 2 });
  },
} satisfies SoundRecipe;
