import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-fire.ts';
export default {
  id: "burning-pallet-stack-in-a-loading-yard-fire-settling", name: "Burning pallet stack in a loading yard — fire settling", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "fire settling", "burning", "pallet", "stack", "in"], loopable: false, durationSec: 5.72,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.278 + .35 * params.intensity, 0.5125, 'open', 'retreat', 0.7579);
  },
} satisfies SoundRecipe;
