import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-chewing.ts';
import source2 from './_recordings/field-leaf-tear.ts';
import source3 from './_recordings/dry-vine-brush.ts';

export default {
  id: "goat-browsing-a-leafy-stem",
  name: "Goat Browsing a Leafy Stem",
  category: "Animals",
  tags: ["goat", "browsing", "leafy", "stem", "livestock"],
  loopable: false,
  durationSec: 1.04,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...sceneCredits(source, source2, source3),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, .87, .63, .036, 7000],
      ['clip', source2, .19, .64, .31, .129, 7400],
      ['clip', source3, .10, .45, .49, .10, 9000],
    ]);
  },
} satisfies SoundRecipe;
