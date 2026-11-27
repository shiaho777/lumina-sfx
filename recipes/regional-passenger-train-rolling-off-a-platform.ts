import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-milestone-train.ts';

export default {
  id: "regional-passenger-train-rolling-off-a-platform",
  name: "Regional Passenger Train Rolling off a Platform",
  category: "Vehicles & Engines",
  tags: ["regional", "passenger", "train", "rolling", "platform", "vehicle"],
  loopable: false,
  durationSec: 5.6,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 5.43, 0.88, 0.21, 5360, 0.032, 0.28],
      ["motor", 0.05, 5.1, 0.17, 96.86, 250.5, 0.67, 0.63],
      ["grains", "iron", 0.32, 4.3, 0.12, 840, 43],
    ]);
  },
} satisfies SoundRecipe;
