import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source2 from './_recordings/isolated-canopy-droplets.ts';

export default {
  isolation: 'isolated', components: ['water-drops'],
  id: "hedgerow-after-rain-loop",
  name: "Hedgerow after Rain",
  category: "Weather & Ambience",
  tags: ["hedgerow", "rain", "ambience"],
  loopable: true,
  durationSec: 14.0,
  targetRmsDbfs: -34,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...sceneCredits(source2),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 400, edge: 1850, drift: .14, density: 4.6, material: "water", texture: .33,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source2, 3.91, .12, .48, 0, 6800, .075, .16],
      ['clip', source2, 11.06, .12, .42, 0, 7000, .072, .15],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
