import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-quadcopter-run.ts';

export default {
  id: "small-drone-liftoff",
  name: "Small Drone Liftoff",
  category: "Aircraft",
  tags: ["small", "drone", "liftoff"],
  loopable: false,
  durationSec: 5.3,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 5.19, .97, .025, 11200, .014, .17],
    ]);
  },
} satisfies SoundRecipe;
