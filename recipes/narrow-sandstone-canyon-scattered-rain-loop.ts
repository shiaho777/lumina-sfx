import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-foliage.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "narrow-sandstone-canyon-scattered-rain-loop",
  name: "Narrow Sandstone Canyon Scattered Rain",
  category: "Weather & Ambience",
  tags: ["narrow", "sandstone", "canyon", "scattered", "rain", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "open", duration: 10.0, force: params.intensity, density: 0.32, pace: 1.47 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "stone", 0.28, 8.74, 0.07, 747.3, 38],
    ]);
    mix(bed, detail);
    mix(bed, sustain(ctx, rain, seed, .97, 2185.5), 0.15);
    return bed;
  },
} satisfies SoundRecipe;
