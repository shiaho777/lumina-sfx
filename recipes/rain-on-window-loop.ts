import type { SoundRecipe } from '../engine/types.ts';
import { biquad } from '../engine/dsp.ts';
import { sustain } from './_shared/field-layers.ts';
import glazing from './_recordings/isolated-rain-glazing.ts';

export default {
  id: 'rain-on-window-loop', name: 'Rain on Window Glass', category: 'Weather & Ambience',
  tags: ['rain', 'rainfall', 'glass', 'window', 'pane', 'inside', 'steady'],
  isolation: 'isolated', components: ['rain'], recording: glazing.credit, mixRole: 'ambience',
  loopable: true, sustainMode: 'evolving', durationSec: 7.2, targetRmsDbfs: -30,
  params: { drops: { label: 'Drops', min: 0, max: 1, default: 0.62 } },
  render(ctx, { seed, params }) {
    // Keep the small unequal impacts on the pane and roll off vibration below their body.
    const amount = params.drops;
    const rain = sustain(ctx, glazing, seed, .90 + amount * .13, 4800 + 2600 * amount, true);
    const glass = biquad('highpass', 330 - amount * 85, .68, ctx.sampleRate);
    return rain.map(glass);
  },
} satisfies SoundRecipe;
