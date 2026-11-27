import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-quadcopter-run.ts';

export default {
  id: "drone-crossing-behind-a-wall",
  name: "Drone Crossing behind a Wall",
  category: "Aircraft",
  tags: ["drone", "crossing", "wall"],
  loopable: false,
  durationSec: 4.5,
  targetRmsDbfs: -29,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "detail",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 2.7, .83, .29, 10700, .09, .68],
      ['clip', source, .96, 3.25, .55, 3.53, 2000, .59, .58],
    ]);
  },
} satisfies SoundRecipe;
