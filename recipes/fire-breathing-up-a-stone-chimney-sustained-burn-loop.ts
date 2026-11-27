import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-flame.ts';
export default {
  id: "fire-breathing-up-a-stone-chimney-sustained-burn-loop", name: "Fire breathing up a stone chimney — sustained burn", category: "Water & Fire",
  tags: ["fire", "field-recording", "passage", "sustained burn", "breathing", "up", "a"], loopable: true, sustainMode: 'evolving', durationSec: 6.98,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.269 + .35 * params.intensity, 0.2125, 'passage', 'steady', 0.5579);
  },
} satisfies SoundRecipe;
