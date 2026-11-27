import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-fire.ts';
export default {
  id: "windward-side-of-a-brush-fire-fire-settling", name: "Windward side of a brush fire — fire settling", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "fire settling", "windward", "side", "of", "a"], loopable: false, durationSec: 4.66,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.360 + .35 * params.intensity, 0.5750, 'open', 'retreat', 0.8526);
  },
} satisfies SoundRecipe;
