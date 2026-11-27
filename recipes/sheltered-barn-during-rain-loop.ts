import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-roof.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "sheltered-barn-during-rain-loop",
  name: "Sheltered Barn during Rain",
  category: "Weather & Ambience",
  tags: ["sheltered", "barn", "rain", "ambience"],
  loopable: true,
  durationSec: 14.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "roof", duration: 14.0, force: params.intensity, density: .42, pace: 1 });
    mix(bed, sustain(ctx, rain, seed, .97, 1680), .29);
    return bed;
  },
} satisfies SoundRecipe;
