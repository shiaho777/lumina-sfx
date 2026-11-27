import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-hearth-wood.ts';
export default {
  id: "fire-breathing-up-a-stone-chimney-fire-settling", name: "Fire breathing up a stone chimney — fire settling", category: "Water & Fire",
  tags: ["fire", "field-recording", "passage", "fire settling", "breathing", "up", "a"], loopable: false, durationSec: 4.79,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.269 + .35 * params.intensity, 0.2125, 'passage', 'retreat', 0.5579);
  },
} satisfies SoundRecipe;
