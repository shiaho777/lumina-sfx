import { mix } from '../engine/dsp.ts';
import { interfaceFeedback } from './_shared/interface-feedback.ts';
import { scene, sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-response-button.ts';

export default {
  id: "menu-confirm-spring-detent",
  name: "Menu confirm spring detent",
  category: "Footsteps & UI",
  tags: ["menu", "confirm", "spring", "detent", "ui", "interface"],
  isolation: 'isolated',
  loopable: false,
  durationSec: 0.174,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "interface",
  ...sceneCredits(source),
  render(ctx, { params, seed }) {
    const bed = interfaceFeedback(ctx, params.intensity, [
      [.006, 345, .016, .55, "plastic"],
      [0, 684, .011, .32, "wood"],
    ]);
    const detail = scene(ctx, seed, params.intensity, [
      ['clip', source, 0, .034, .85, 0, 6200, .0003, .005],
    ]);
    mix(bed, detail);
    return bed;
  },
} satisfies SoundRecipe;
