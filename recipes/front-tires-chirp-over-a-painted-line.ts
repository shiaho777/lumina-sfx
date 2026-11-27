import type { SoundRecipe } from '../engine/types.ts';
import { scene, sceneCredits } from './_shared/material-scenes.ts';
import recording1 from './_recordings/car-tire-skid-launch.ts';
import recording2 from './_recordings/isolated-tire-scrub.ts';

export default {
  id: 'front-tires-chirp-over-a-painted-line', name: 'Front tires chirp over a painted line', category: 'Vehicles & Engines',
  tags: ["vehicle", "front", "tires", "chirp", "over", "a", "painted", "line", "rubber", "foley"], loopable: false, durationSec: 0.26,
  mixRole: 'vehicle', targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: .55 } },
  ...sceneCredits(recording1, recording2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', recording1, 0.0, 0.145, 0.93, 0.8, 11500, 0.001, 0.027549999999999998],
      ['clip', recording2, 0.078, 0.12, 0.49, 0.23, 5700, 0.006, 0.0228],
      ["contact", "rubber", 0.08, 0.06, 0.12, 1720, 0.003],
    ]);
  },
} satisfies SoundRecipe;
