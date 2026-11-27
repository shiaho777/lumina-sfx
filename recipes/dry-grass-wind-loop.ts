import type { SoundRecipe } from '../engine/types.ts';
import blades from './_recordings/isolated-dry-meadow-breeze.ts';
import { sustain } from './_shared/field-layers.ts';
import { biquad } from '../engine/dsp.ts';

export default {
  id: 'dry-grass-wind-loop', name: 'Wind moving through dry grass', category: 'Weather & Ambience',
  tags: ['dry', 'grass', 'wind', 'breeze', 'meadow', 'field', 'blades', 'rustle', 'gust'],
  closeMatches: [{ phrases: ['grass reeds', 'reed grass'], term: 'reed', note: 'Wind in dry grass supplies the rustle. The grass species is undocumented.' }],
  isolation: 'isolated', components: ['grass-rustle'], recording: blades.credit,
  loopable: true, sustainMode: 'evolving', durationSec: 6.5, mixRole: 'ambience', targetRmsDbfs: -31,
  params: { breeze: {label: 'Breeze', min: 0, max: 1, default: 0.4} },
  render(ctx, {seed, params}) {
    // Keep the individual blade movements within the recorded gust.
    const sound = sustain(ctx, blades, seed, 0.94 + params.breeze * 0.13, 5900 + params.breeze * 2500);
    return sound.map(biquad('highpass', 220, 0.65, ctx.sampleRate));
  },
} satisfies SoundRecipe;
