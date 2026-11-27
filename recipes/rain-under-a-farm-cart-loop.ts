import { mix } from '../engine/dsp.ts';
import { atmosphere, scene } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import rain from './_recordings/isolated-rain-roof.ts';

export default {
  isolation: 'isolated', components: ['rain'],
  id: "rain-under-a-farm-cart-loop",
  name: "Rain under a Farm Cart",
  category: "Weather & Ambience",
  tags: ["rain", "under", "farm", "cart", "ambience"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -29,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: rain.credit,
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 410, edge: 1350, drift: .12, density: 28, material: "water", texture: .81,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ["grains", "wood", .1, 8.7, .08, 231, 41],
    ]);
    mix(bed, detail);
    mix(bed, sustain(ctx, rain, seed, .97, 2200), .19);
    return bed;
  },
} satisfies SoundRecipe;
