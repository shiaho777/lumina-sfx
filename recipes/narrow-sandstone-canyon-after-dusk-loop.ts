import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/demo-sheltered-wind.ts';
import source2 from './_recordings/field-night-crickets.ts';

export default {
  contains: ['night insects', 'crickets'],
  id: "narrow-sandstone-canyon-after-dusk-loop",
  name: "Narrow Sandstone Canyon after Dusk",
  category: "Weather & Ambience",
  tags: ["narrow", "sandstone", "canyon", "dusk", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 182, edge: 1001.1, drift: 0.1659, density: 2.9, material: "stone", texture: 0.22,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 10.075, 0.34, 2.18, 1536.9, 0, 0],
      ['clip', source2, 0, 10.075, 0.25, 1.3, 2016.3, 0, 0],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
