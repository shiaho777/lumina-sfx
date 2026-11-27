import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-ring-fire.ts';
export default {
  id: "hearth-fire-behind-an-iron-grate-sustained-burn-loop", name: "Hearth fire behind an iron grate — sustained burn", category: "Water & Fire",
  tags: ["fire", "field-recording", "interior", "sustained burn", "hearth", "behind", "an"], loopable: true, sustainMode: 'evolving', durationSec: 7.39,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.307 + .35 * params.intensity, 0.5750, 'interior', 'steady', 0.7211);
  },
} satisfies SoundRecipe;
