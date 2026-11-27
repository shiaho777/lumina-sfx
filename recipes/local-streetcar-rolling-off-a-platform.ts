import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-rail-bend.ts';

export default {
  id: "local-streetcar-rolling-off-a-platform",
  name: "Local Streetcar Rolling off a Platform",
  category: "Vehicles & Engines",
  tags: ["local", "streetcar", "rolling", "platform", "vehicle"],
  loopable: false,
  durationSec: 5.6,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 5.43, 0.88, 0.21, 6432, 0.032, 0.28],
      ["motor", 0.05, 5.1, 0.17, 116.58, 301.5, 0.67, 0.51],
      ["grains", "iron", 0.32, 4.3, 0.12, 1008, 43],
    ]);
  },
} satisfies SoundRecipe;
