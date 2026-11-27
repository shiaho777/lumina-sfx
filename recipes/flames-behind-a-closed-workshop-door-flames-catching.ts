import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-wood-fire.ts';
export default {
  id: "flames-behind-a-closed-workshop-door-flames-catching", name: "Flames behind a closed workshop door — flames catching", category: "Water & Fire",
  tags: ["fire", "field-recording", "screened", "flames catching", "flames", "behind", "a", "closed"], loopable: false, durationSec: 5.59,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.163 + .35 * params.intensity, 0.1212, 'screened', 'surge', 0.1526);
  },
} satisfies SoundRecipe;
