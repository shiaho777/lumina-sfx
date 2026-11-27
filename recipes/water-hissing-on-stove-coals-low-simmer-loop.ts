import { biquad, noise } from '../engine/dsp.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-ring-fire.ts';
export default {
  id: "water-hissing-on-stove-coals-low-simmer-loop", name: "Water hissing on stove coals — low simmer", category: "Water & Fire",
  tags: ["fire", "field-recording", "interior", "low simmer", "water", "hissing", "on", "stove"], loopable: true, sustainMode: 'evolving', durationSec: 6.68,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  recording: burn.credit, components: ['fire', 'steam'], isolation:'isolated',
  render(ctx, {seed, params}) {
    const fire = woodFire(ctx, burn, seed, 0.326 + .35 * params.intensity, 0.6438, 'interior', 'scattered', 0.8211);
    const air = noise(ctx.random, 'white'), steam = biquad('bandpass',3500,.72,ctx.sampleRate);
    return fire.map((v,i)=>v+.018*params.intensity*steam(air())*Math.exp(-2.8*i/ctx.frames));
  },
} satisfies SoundRecipe;
