import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-glazing.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-on-a-fabric-parasol-loop",
  name: "Rain on a Fabric Parasol",
  category: "Weather & Ambience",
  tags: ["rain", "fabric", "parasol", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -29,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "mist", duration: 9.0, force: params.intensity, density: .71, pace: 4 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "cloth", .10, 8.55, .21, 395, 137],

    ]);
    mix(bed, detail);
    mix(bed, sustain(ctx, rain, seed, .97, 4500), .18);
    return bed;
  },
} satisfies SoundRecipe;
