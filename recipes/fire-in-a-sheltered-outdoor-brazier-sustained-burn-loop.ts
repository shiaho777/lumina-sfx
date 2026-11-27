import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-ring-fire.ts';
export default {
  id: "fire-in-a-sheltered-outdoor-brazier-sustained-burn-loop", name: "Fire in a sheltered outdoor brazier — sustained burn", category: "Water & Fire",
  tags: ["fire", "field-recording", "screened", "sustained burn", "in", "a", "sheltered"], loopable: true, sustainMode: 'evolving', durationSec: 7.33,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.197 + .35 * params.intensity, 0.5188, 'screened', 'steady', 0.5684);
  },
} satisfies SoundRecipe;
