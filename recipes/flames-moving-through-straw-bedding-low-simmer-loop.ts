import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-fire.ts';
export default {
  id: "flames-moving-through-straw-bedding-low-simmer-loop", name: "Flames moving through straw bedding — low simmer", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "low simmer", "flames", "moving", "through", "straw"], loopable: true, sustainMode: 'evolving', durationSec: 6.58,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.365 + .35 * params.intensity, 0.6875, 'open', 'scattered', 0.7842);
  },
} satisfies SoundRecipe;
