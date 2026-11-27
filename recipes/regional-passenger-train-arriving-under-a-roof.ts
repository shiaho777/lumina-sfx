import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-milestone-train.ts';

export default {
  id: "regional-passenger-train-arriving-under-a-roof",
  name: "Regional Passenger Train Arriving under a Roof",
  category: "Vehicles & Engines",
  tags: ["regional", "passenger", "train", "arriving", "under", "roof", "vehicle"],
  loopable: false,
  durationSec: 5.2,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 5.12, 0.81, 0.49, 4520, 0.021, 0.46],
      ['clip', source, 0.058, 4.9, 0.23, 0.55, 1800, 0.025, 0.54],
      ["contact", "rubber", 3.9, 0.62, 0.23, 167, 0.002],
    ]);
  },
} satisfies SoundRecipe;
