import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-hearth-wood.ts';
export default {
  id: "fire-breathing-up-a-stone-chimney-flames-catching", name: "Fire breathing up a stone chimney — flames catching", category: "Water & Fire",
  tags: ["fire", "field-recording", "passage", "flames catching", "breathing", "up", "a"], loopable: false, durationSec: 4.67,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.269 + .35 * params.intensity, 0.2125, 'passage', 'surge', 0.5579);
  },
} satisfies SoundRecipe;
