import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-rail-bend.ts';
import source2 from './_recordings/demo-rail-joints.ts';

export default {
  id: "streetcar-departure-through-a-junction",
  name: "Streetcar Departure through a Junction",
  category: "Vehicles & Engines",
  tags: ["streetcar", "departure", "junction", "vehicle"],
  loopable: false,
  durationSec: 5.2,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 4.92, .86, .42, 7900, .027, .39],
      ['clip', source2, 1.5, 3.5, .36, .38, 9800, .20, .35],
    ]);
  },
} satisfies SoundRecipe;
