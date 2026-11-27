import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/demo-station-room.ts';
import source2 from './_recordings/isolated-demo-carriage-bed.ts';

export default {
  id: "train-concourse-quiet-night-loop",
  name: "Train Concourse Quiet Night",
  category: "Weather & Ambience",
  tags: ["train", "concourse", "quiet", "night", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -33,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  ...sceneCredits(source, source2),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 232, edge: 795, drift: .14, density: 1.74, material: "iron", texture: .21,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 10.075, .47, .79, 2520, 0, 0],
      ['clip', source2, 5.2, 3.55, .12, .26, 1800, .64, .88],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
