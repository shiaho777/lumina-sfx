import type { SoundRecipe } from '../engine/types.ts';
import { surfaceRain } from './_shared/weather-textures.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-in-leaves-loop", name: "Rain Under a Leaf Canopy", category: 'Weather & Ambience',
  tags: ["rain","forest","leaves","canopy"], loopable: true, durationSec: 8.5,
  params: { drips: { label: "Drips", min: 0, max: 1, default: 0.64 } },
  render(ctx, { params }) {
    return surfaceRain(ctx, { duration: 8.5, material: 'leaves', force: 0.34, density: 0.32 + params.drips * 0.48, pace: 3 });
  },
} satisfies SoundRecipe;
