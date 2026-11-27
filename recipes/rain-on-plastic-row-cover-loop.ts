import { mix } from '../engine/dsp.ts';
import { surfaceRain } from './_shared/weather-textures.ts';
import { scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-glazing.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-on-plastic-row-cover-loop",
  name: "Rain on Plastic Row Cover",
  category: "Weather & Ambience",
  tags: ["rain", "plastic", "row", "cover", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = surfaceRain(ctx, { material: "open", duration: 9.0, force: params.intensity, density: .51, pace: 3 });
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "rubber", .02, 8.8, .26, 335, 104],

    ]);
    mix(bed, detail);
    mix(bed, sustain(ctx, rain, seed, .97, 4500), .18);
    return bed;
  },
} satisfies SoundRecipe;
