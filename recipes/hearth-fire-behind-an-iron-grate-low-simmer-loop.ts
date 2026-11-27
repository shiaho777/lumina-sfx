import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-ring-fire.ts';
export default {
  id: "hearth-fire-behind-an-iron-grate-low-simmer-loop", name: "Hearth fire behind an iron grate — low simmer", category: "Water & Fire",
  tags: ["fire", "field-recording", "interior", "low simmer", "hearth", "behind", "an"], loopable: true, sustainMode: 'evolving', durationSec: 7.27,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.307 + .35 * params.intensity, 0.5750, 'interior', 'scattered', 0.7211);
  },
} satisfies SoundRecipe;
