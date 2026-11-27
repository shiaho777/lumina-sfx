import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-foliage.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "shaded-rocky-creek-scattered-rain-loop",
  name: "Shaded Rocky Creek Scattered Rain",
  category: "Weather & Ambience",
  tags: ["shaded", "rocky", "creek", "scattered", "rain", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "puddles", duration: 10.0, force: params.intensity, density: 0.32, pace: 1.54 });
    // Impact comes from the water itself. Keep the stream and other location sounds independent.
    mix(bed, sustain(ctx, rain, seed, .96, 4500), .27);
    return bed;
  },
} satisfies SoundRecipe;
