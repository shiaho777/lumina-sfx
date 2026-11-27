import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-chewing.ts';
import source2 from './_recordings/bundle-dry-stalks.ts';

export default {
  id: "sheep-grazing-close",
  name: "Sheep Grazing Close",
  category: "Animals",
  tags: ["sheep", "grazing", "close", "livestock"],
  loopable: false,
  durationSec: 1.61,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 1.35, .74, .05, 8200],
      ['clip', source2, .16, .63, .42, .02, 7200],
      ['clip', source, .81, .68, .44, .66, 6300],
    ]);
  },
} satisfies SoundRecipe;
