import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/field-cow-feeding.ts';
import source2 from './_recordings/isolated-chewing.ts';

export default {
  id: "cow-snorting-at-the-feed-rail",
  name: "Cow Snorting at the Feed Rail",
  category: "Animals",
  tags: ["cow", "snorting", "feed", "rail", "livestock"],
  loopable: false,
  durationSec: 0.92,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, .74, .81, .83, 6600],
      ['clip', source2, .105, .69, .38, .128, 8100],
      ["brush", "air", .03, .28, .17, 280, .019],
    ]);
  },
} satisfies SoundRecipe;
