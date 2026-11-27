import type { SoundRecipe } from '../engine/types.ts';
import { independentRain } from './_shared/independent-rain.ts';
import drops from './_recordings/isolated-canopy-droplets.ts';
import { surfaceRain } from './_shared/weather-textures.ts';

export default {
  id: "rain-on-puddles-loop", name: "Rain on Puddles", category: 'Weather & Ambience',
  tags: ["rain","puddles","water","splashes"], loopable: true, sustainMode: 'evolving', durationSec: 7,
  components: ['rain'], isolation: 'isolated', recording:drops.credit,
  params: { splash: { label: "Splash", min: 0, max: 1, default: 0.66 } },
  render(ctx, { params }) {
    const ripples = surfaceRain(ctx, { duration: 7, material: 'puddles', force: 0.55, density: 0.32 + params.splash * 0.67, pace: 3 });
    const shower = independentRain(ctx, .54 + .25 * params.splash, false);
    return shower.map((x,i) => x + .15 * ripples[i]);
  },
} satisfies SoundRecipe;
