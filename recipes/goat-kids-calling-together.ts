import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-young-goat.ts';
import source2 from './_recordings/goat-double-bleat.ts';

export default {
  id: "goat-kids-calling-together",
  name: "Goat Kids Calling Together",
  category: "Animals",
  tags: ["goat", "kids", "calling", "together", "livestock"],
  loopable: false,
  durationSec: 1.6,
  targetRmsDbfs: -23,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, .85, .95, .009, 11600],
      ['clip', source2, .39, .69, .35, .32, 6700, 0.027, .105],
      ['clip', source, .79, .72, .56, .112, 9600],
    ]);
  },
} satisfies SoundRecipe;
