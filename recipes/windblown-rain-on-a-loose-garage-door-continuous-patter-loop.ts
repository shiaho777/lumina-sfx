import type { SoundRecipe } from '../engine/types.ts';
import roof from './_recordings/isolated-rain-roof.ts';
import { sustain } from './_shared/field-layers.ts';
import { independentRain } from './_shared/independent-rain.ts';
import { biquad } from '../engine/dsp.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-canopy-droplets.ts';

export default {
  id: "windblown-rain-on-a-loose-garage-door-continuous-patter-loop", name: "Windblown rain on a loose garage door — continuous patter", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "interior", "continuous patter", "windblown", "rain on metal", "door", "sheet steel"], loopable: true, sustainMode: 'evolving', durationSec: 6.98,
  auditionNote: 'The sustained wash masks individual drops in blind auditions. For short rain on a metal door, use the receding downpour take.',
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(roof, source), isolation: 'isolated', components: ['rain'],
  render(ctx, { params, seed }) {
    const rain = independentRain(ctx, params.intensity * 0.58, true, true);
    const roofTake = sustain(ctx, roof, seed, .93, 2450 + 550 * params.intensity, true);
    const panel = biquad('bandpass', 182, 3.2, ctx.sampleRate);
    const frame = biquad('bandpass', 427, 2.1, ctx.sampleRate);
    const dullEdge = biquad('lowpass', 3100, 0.7, ctx.sampleRate);
    const spring = biquad('bandpass', 117, 3.7, ctx.sampleRate);
    for (let i = 0; i < rain.length; i++) {
      const drop = rain[i];
      const flex = panel(drop);
      // Only the stronger drops excite the loose panel against its frame.
      const contact = Math.sign(flex) * Math.max(0, Math.abs(flex) - 0.007);
      rain[i] = roofTake[i] + .12 * dullEdge(drop) + .27 * flex + .14 * frame(drop) + .19 * spring(contact);
    }
    return rain;
  },
} satisfies SoundRecipe;
