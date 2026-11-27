import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-fire.ts';
export default {
  id: "flames-moving-through-straw-bedding-fire-settling", name: "Flames moving through straw bedding — fire settling", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "fire settling", "flames", "moving", "through", "straw"], loopable: false, durationSec: 4.47,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.365 + .35 * params.intensity, 0.6875, 'open', 'retreat', 0.7842);
  },
} satisfies SoundRecipe;
