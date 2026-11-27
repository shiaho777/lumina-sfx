import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-on-a-stone-courtyard-loop",
  name: "Rain on a Stone Courtyard",
  category: "Weather & Ambience",
  tags: ["rain", "stone", "courtyard", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "puddles", duration: 9.0, force: params.intensity, density: .73, pace: 2 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "stone", .17, 8.55, .24, 1080, 147],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
