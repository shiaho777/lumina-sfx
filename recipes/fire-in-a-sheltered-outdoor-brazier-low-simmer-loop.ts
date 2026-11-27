import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-ring-fire.ts';
export default {
  id: "fire-in-a-sheltered-outdoor-brazier-low-simmer-loop", name: "Fire in a sheltered outdoor brazier — low simmer", category: "Water & Fire",
  tags: ["fire", "field-recording", "screened", "low simmer", "in", "a", "sheltered"], loopable: true, sustainMode: 'evolving', durationSec: 7.21,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.197 + .35 * params.intensity, 0.5188, 'screened', 'scattered', 0.5684);
  },
} satisfies SoundRecipe;
