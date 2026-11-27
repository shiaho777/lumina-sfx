import type { SoundRecipe } from '../engine/types.ts';
import { scene, sceneCredits } from './_shared/material-scenes.ts';
import recording1 from './_recordings/isolated-tire-scrub.ts';
import recording2 from './_recordings/milestone-smallwater.ts';

export default {
  id: 'wet-asphalt-slide-throws-a-fan-of-spray', name: 'Wet asphalt slide throws a fan of spray', category: 'Vehicles & Engines',
  tags: ["vehicle", "wet", "asphalt", "slide", "throws", "a", "fan", "of", "spray", "water", "foley"], loopable: false, durationSec: 1.29,
  mixRole: 'vehicle', targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: .55 } },
  ...sceneCredits(recording1, recording2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', recording1, 0.0, 1.23, 0.96, 0.17, 10300, 0.001, 0.09],
      ['clip', recording2, 0.23, 0.74, 0.24, 0.18, 4900, 0.006, 0.09],
      ["grains", "water", 0.91, 0.25, 0.13, 920, 8],
    ]);
  },
} satisfies SoundRecipe;
