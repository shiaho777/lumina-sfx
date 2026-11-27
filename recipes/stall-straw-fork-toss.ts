import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/bundle-dry-stalks.ts';

export default {
  id: "stall-straw-fork-toss",
  name: "Stall Straw Fork Toss",
  category: "Animals",
  tags: ['hay', 'scatter', "stall", "straw", "fork", "toss", "livestock"],
  loopable: false,
  durationSec: 1.24,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 1.05, .79, .05, 10000],
    ]);
  },
} satisfies SoundRecipe;
