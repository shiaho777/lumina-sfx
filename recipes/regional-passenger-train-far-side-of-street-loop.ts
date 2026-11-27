import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-carriage-bed.ts';
import source2 from './_recordings/isolated-milestone-train.ts';

export default {
  id: "regional-passenger-train-far-side-of-street-loop",
  name: "Regional Passenger Train Far Side of Street",
  category: "Vehicles & Engines",
  tags: ["regional", "passenger", "train", "far", "side", "street", "vehicle"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 204, edge: 1280, drift: 0.17, density: 1.4, material: "air", texture: 0.24,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 9.075, 0.47, 0.54, 1840, 0, 0],
      ['clip', source2, 1.17, 6.8, 0.28, 0.17, 2040, 1.24, 1.78],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
