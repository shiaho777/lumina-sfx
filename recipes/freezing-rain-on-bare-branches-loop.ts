import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-foliage.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "freezing-rain-on-bare-branches-loop",
  name: "Freezing Rain on Bare Branches",
  category: "Weather & Ambience",
  tags: ["freezing", "rain", "bare", "branches", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -31,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "leaves", duration: 9.0, force: params.intensity, density: .32, pace: 2 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "glass", .10, 8.6, .22, 1120, 73],
    ]);
    mix(bed, detail);
    mix(bed, sustain(ctx, rain, seed, .97, 6040), .19);
    return bed;
  },
} satisfies SoundRecipe;
