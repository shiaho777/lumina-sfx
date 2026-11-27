import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-tire-scrub.ts';

import road from './_recordings/car-wet-asphalt-pass.ts';

export default {
  perspective: "roadside exterior", contains: ["braking on wet asphalt", "rubber catches"], markers: {"skidPeak": 0.56, "catch": 1.02},
  id: "tire-skid-halt",
  name: "Tire skid halt",
  category: "Vehicles & Engines",
  tags: ["tire", "skid", "halt", "vehicle"],
  loopable: false,
  durationSec: 1.42,
  targetRmsDbfs: -25.5,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source, road),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 1.40, 1.04, .16, 10900, .002, .14],
      ['clip', road, .012, .92, .31, 1.10, 3200, .035, .18],
      ['brush', 'rubber', .095, .42, .11, 720, .008],
      ['contact', 'rubber', 1.02, .18, .18, 156, .004],
    ]);
  },
} satisfies SoundRecipe;
