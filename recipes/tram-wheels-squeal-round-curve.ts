import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-rail-bend.ts';

export default {
  id: "tram-wheels-squeal-round-curve",
  name: "Tram Wheels Squeal round Curve",
  category: "Vehicles & Engines",
  tags: ["tram", "wheels", "squeal", "round", "curve", "vehicle"],
  loopable: false,
  durationSec: 7.1,
  targetRmsDbfs: -24,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 6.95, .94, .13, 11400, .026, .45],
    ]);
  },
} satisfies SoundRecipe;
