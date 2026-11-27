import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-roof.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "windward-headland-scattered-rain-loop",
  name: "Windward Headland Scattered Rain",
  category: "Weather & Ambience",
  tags: ["windward", "headland", "scattered", "rain", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "open", duration: 10.0, force: params.intensity, density: 0.32, pace: 2.24 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "stone", 0.28, 8.74, 0.07, 1367.4, 38],
    ]);
    mix(bed, detail);
    mix(bed, sustain(ctx, rain, seed, .97, 3999), 0.15);
    return bed;
  },
} satisfies SoundRecipe;
