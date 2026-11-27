import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-hearth-wood.ts';
export default {
  id: "hearth-fire-behind-an-iron-grate-fire-settling", name: "Hearth fire behind an iron grate — fire settling", category: "Water & Fire",
  tags: ["fire", "field-recording", "interior", "fire settling", "hearth", "behind", "an"], loopable: false, durationSec: 5.25,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.307 + .35 * params.intensity, 0.5750, 'interior', 'retreat', 0.7211);
  },
} satisfies SoundRecipe;
