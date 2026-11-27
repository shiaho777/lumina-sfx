import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/demo-station-room.ts';
import source2 from './_recordings/isolated-rail-bend.ts';

export default {
  id: "local-streetcar-rattle-between-cars-loop",
  name: "Local Streetcar Rattle between Cars",
  category: "Vehicles & Engines",
  tags: ["local", "streetcar", "rattle", "between", "cars", "vehicle"],
  loopable: true,
  durationSec: 9.0,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 205, edge: 2112, drift: 0.17, density: 5, material: "iron", texture: 0.29,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 9.075, 0.54, 0.6, 4800, 0, 0],
      ['clip', source2, 1.13, 6.61, 0.46, 0.15, 5280, 1.1, 1.8],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
