import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/truck-air-brake-release.ts';
import source2 from './_recordings/isolated-milestone-train.ts';

export default {
  id: "regional-passenger-train-release-of-air-at-a-gate",
  name: "Regional Passenger Train Release of Air at a Gate",
  category: "Vehicles & Engines",
  tags: ["regional", "passenger", "train", "release", "air", "gate", "vehicle"],
  loopable: false,
  durationSec: 2.3,
  targetRmsDbfs: -24,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "foley",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 1.48, 0.67, 0.009, 8400, 0.007, 0.08],
      ['clip', source2, 0.22, 1.72, 0.32, 0.8, 2680, 0.07, 0.39],
      ["contact", "iron", 0.98, 0.38, 0.33, 360.72, 0.002],
    ]);
  },
} satisfies SoundRecipe;
