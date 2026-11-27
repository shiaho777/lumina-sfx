import { biquad, noise } from '../engine/dsp.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import burn from './_recordings/isolated-hearth-wood.ts';
export default {
  id: "water-hissing-on-stove-coals-flames-catching", name: "Water hissing on stove coals — flames catching", category: "Water & Fire",
  tags: ["fire", "field-recording", "interior", "flames catching", "water", "hissing", "on", "stove"], loopable: false, durationSec: 4.46,
  mixRole: "ambience", targetRmsDbfs: -24,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  recording: burn.credit, components: ['fire', 'steam'], isolation:'isolated',
  render(ctx, {seed, params}) {
    const fire = woodFire(ctx, burn, seed, 0.326 + .35 * params.intensity, 0.6438, 'interior', 'surge', 0.8211);
    const air = noise(ctx.random, 'white'), steam = biquad('bandpass',3500,.72,ctx.sampleRate);
    return fire.map((v,i)=>v+.018*params.intensity*steam(air())*Math.exp(-2.8*i/ctx.frames));
  },
} satisfies SoundRecipe;
