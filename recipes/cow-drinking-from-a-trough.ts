import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/field-cow-feeding.ts';
import source2 from './_recordings/metal-pail-pour.ts';
import source3 from './_recordings/isolated-chewing.ts';

export default {
  id: "cow-drinking-from-a-trough",
  name: "Cow Drinking from a Trough",
  category: "Animals",
  tags: ["cow", "drinking", "trough", "livestock"],
  loopable: false,
  durationSec: 1.97,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...sceneCredits(source, source2, source3),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 1.28, .50, .215, 5450],
      ['clip', source2, .175, 1.50, .61, .01, 7400],
      ['clip', source3, 1.20, .63, .30, .12, 7100],
    ]);
  },
} satisfies SoundRecipe;
