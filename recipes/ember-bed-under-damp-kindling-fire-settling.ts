import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-hearth-wood.ts';
export default {
  id: "ember-bed-under-damp-kindling-fire-settling", name: "Ember bed under damp kindling — fire settling", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "fire settling", "ember", "bed", "under", "damp"], loopable: false, durationSec: 4.82,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.259 + .35 * params.intensity, 0.5875, 'open', 'retreat', 0.6737);
  },
} satisfies SoundRecipe;
