import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-carriage-bed.ts';

export default {
  id: "rail-cabin-rolling-loop",
  name: "Rail Cabin Rolling",
  category: "Vehicles & Engines",
  tags: ["rail", "cabin", "rolling", "vehicle"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -31,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 190, edge: 610, drift: .23, density: 1.55, material: "wood", texture: .145,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 9.075, .88, .64, 1850, 0, 0],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
