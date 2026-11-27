import type { SoundRecipe } from '../engine/types.ts';
import { biquad } from '../engine/dsp.ts';
import drops from './_recordings/isolated-canopy-droplets.ts';
import { independentRain } from './_shared/independent-rain.ts';

export default {
  id: "rain-on-a-parked-car-canopy-loop",
  name: "Rain on a Parked Car Canopy",
  category: "Weather & Ambience",
  tags: ["rain", "parked", "car", "canopy", "ambience"],
  loopable: true, sustainMode: 'evolving',
  durationSec: 10.0,
  targetRmsDbfs: -28,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  components: ['rain'],
  isolation: 'isolated',
  recording: drops.credit,
  render(ctx, { params }) {
    const roof = biquad('bandpass', 380, 1.15, ctx.sampleRate);
    return independentRain(ctx, params.intensity, true).map(x => .7 * x + .85 * roof(x));
  },
} satisfies SoundRecipe;
