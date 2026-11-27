import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/demo-jet-pass.ts';

export default {
  id: "jet-pass-overhead",
  name: "Jet pass overhead",
  category: "Aircraft",
  tags: ['flyby', 'distant', 'roll', "jet", "pass", "overhead"],
  loopable: false,
  durationSec: 3.64,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 3.64, .92, .62, 3100 + 3500 * params.intensity, .004, .39],
    ]);
  },
} satisfies SoundRecipe;
