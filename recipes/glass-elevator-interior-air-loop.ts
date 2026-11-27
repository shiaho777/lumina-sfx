import { mix } from '../engine/dsp.ts';
import { atmosphere, scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-carriage-bed.ts';

export default {
  id: "glass-elevator-interior-air-loop",
  name: "Glass Elevator Interior Air",
  category: "Weather & Ambience",
  tags: ["glass", "elevator", "interior", "air", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -35,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    const bed = atmosphere(ctx, {
      body: 190, edge: 865, drift: .14, density: 1.81, material: "air", texture: .18,
    }, params.intensity);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, 10.075, .26, 1.24, 920, 0, 0],
      ["motor", 0, 10.075, .012, 56, 58, .21, .42],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
