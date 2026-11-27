import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-fire.ts';
export default {
  id: "flames-moving-through-straw-bedding-sustained-burn-loop", name: "Flames moving through straw bedding — sustained burn", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "sustained burn", "flames", "moving", "through", "straw"], loopable: true, sustainMode: 'evolving', durationSec: 6.7,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.365 + .35 * params.intensity, 0.6875, 'open', 'steady', 0.7842);
  },
} satisfies SoundRecipe;
