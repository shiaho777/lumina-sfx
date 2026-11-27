import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-quadcopter-hover.ts';

export default {
  id: "small-drone-close-hover-loop",
  name: "Small Drone Close Hover",
  category: "Aircraft",
  tags: ["small", "drone", "close", "hover"],
  loopable: true,
  durationSec: 8.0,
  targetRmsDbfs: -28,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 280, edge: 2540, drift: .1, density: 1.0, material: "air", texture: .11,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 8.075, .96, .49, 11400, 0, 0],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
