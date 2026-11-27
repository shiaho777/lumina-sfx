import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "heavy-rain-on-wooden-shingles-loop",
  name: "Heavy Rain on Wooden Shingles",
  category: "Weather & Ambience",
  tags: ["heavy", "rain", "wooden", "shingles", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -24,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "roof", duration: 9.0, force: params.intensity, density: .91, pace: 2 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "wood", .02, 8.7, .09, 265, 97],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
