import { mix } from '../engine/dsp.ts';
import { atmosphere } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-roof.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-behind-a-closed-wooden-shutter-loop",
  name: "Rain behind a Closed Wooden Shutter",
  category: "Weather & Ambience",
  tags: ["rain", "closed", "wooden", "shutter", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -31,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 233, edge: 840, drift: .24, density: 47, material: "wood", texture: .38,
    }, params.intensity);
    mix(bed, sustain(ctx, rain, seed, .97, 820), .17);
    return bed;
  },
} satisfies SoundRecipe;
