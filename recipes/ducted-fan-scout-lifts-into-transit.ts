import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-quadcopter-hover.ts';
import source2 from './_recordings/isolated-demo-quadcopter-run.ts';

export default {
  id: "ducted-fan-scout-lifts-into-transit",
  name: "Ducted fan scout lifts into transit",
  category: "Aircraft",
  tags: ["ducted", "fan", "scout", "lifts", "transit", "flight"],
  loopable: false,
  durationSec: 3.73,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    return scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 2.92, .41, .14, 6400, .009, .6],
      ['clip', source2, 1.37, 2.36, .53, .18, 5600, .28, .51],
      ["motor", 0, 3.6, .22, 124, 412, .021, .48],
    ]);
  },
} satisfies SoundRecipe;
