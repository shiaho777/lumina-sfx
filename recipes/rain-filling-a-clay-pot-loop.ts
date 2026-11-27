import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-drain.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-filling-a-clay-pot-loop",
  name: "Rain Filling a Clay Pot",
  category: "Weather & Ambience",
  tags: ["rain", "filling", "clay", "pot", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -28,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "puddles", duration: 9.0, force: params.intensity, density: .29, pace: 1 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "glass", .2, 8.4, .19, 620, 41],

    ]);
    mix(bed, detail);
    mix(bed, sustain(ctx, rain, seed, .97, 4500), .18);
    return bed;
  },
} satisfies SoundRecipe;
