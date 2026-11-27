import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-hearth-wood.ts';
export default {
  id: "ember-bed-under-damp-kindling-sustained-burn-loop", name: "Ember bed under damp kindling — sustained burn", category: "Water & Fire",
  tags: ["fire", "field-recording", "open", "sustained burn", "ember", "bed", "under", "damp"], loopable: true, sustainMode: 'evolving', durationSec: 7.01,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  recording: burn.credit, components: ['fire'], isolation:'isolated',
  render(ctx, {seed, params}) {
    return woodFire(ctx, burn, seed, 0.259 + .35 * params.intensity, 0.5875, 'open', 'steady', 0.6737);
  },
} satisfies SoundRecipe;
