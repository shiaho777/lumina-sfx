import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/truck-air-brake-release.ts';
import source2 from './_recordings/isolated-rail-bend.ts';

export default {
  id: "local-streetcar-release-of-air-at-a-gate",
  name: "Local Streetcar Release of Air at a Gate",
  category: "Vehicles & Engines",
  tags: ["local", "streetcar", "release", "air", "gate", "vehicle"],
  loopable: false,
  durationSec: 2.3,
  targetRmsDbfs: -24,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "foley",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 1.48, 0.67, 0.009, 10080, 0.007, 0.08],
      ['clip', source2, 0.22, 1.72, 0.32, 0.8, 3216, 0.07, 0.39],
      ["contact", "iron", 0.98, 0.38, 0.33, 434.16, 0.002],
    ]);
  },
} satisfies SoundRecipe;
