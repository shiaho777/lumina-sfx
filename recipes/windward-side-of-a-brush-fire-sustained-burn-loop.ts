import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-fire.ts';
export default {
  id: "windward-side-of-a-brush-fire-sustained-burn-loop", name: "Windward side of a brush fire — sustained burn", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "sustained burn", "windward", "side", "of", "a"], loopable: true, sustainMode: 'evolving', durationSec: 6.87,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.360 + .35 * params.intensity, 0.5750, 'open', 'steady', 0.8526);
  },
} satisfies SoundRecipe;
