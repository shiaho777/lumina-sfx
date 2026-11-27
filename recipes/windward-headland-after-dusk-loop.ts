import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/milestone-ocean.ts';
import source2 from './_recordings/field-night-crickets.ts';

export default {
  contains: ['night insects', 'crickets'],
  id: "windward-headland-after-dusk-loop",
  name: "Windward Headland after Dusk",
  category: "Weather & Ambience",
  tags: ["windward", "headland", "dusk", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 346.5, edge: 1831.8, drift: 0.2528, density: 2.9, material: "stone", texture: 0.22,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 10.075, 0.34, 2.18, 2812.2, 0, 0],
      ['clip', source2, 0, 10.075, 0.25, 1.3, 3689.4, 0, 0],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
