import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-foliage.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "light-rain-on-dry-straw-loop",
  name: "Light Rain on Dry Straw",
  category: "Weather & Ambience",
  tags: ["light", "rain", "dry", "straw", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -30,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "leaves", duration: 9.0, force: params.intensity, density: .19, pace: 1 });
    mix(bed, sustain(ctx, rain, seed, .97, 3400), .22);
    return bed;
  },
} satisfies SoundRecipe;
