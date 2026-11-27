import type { SoundRecipe } from '../engine/types.ts';
import { biquad } from '../engine/dsp.ts';
import { renderRecording } from '../engine/recording.ts';
import sparrow from './_recordings/natural-sparrow.ts';

export default {
  id: 'house-sparrow-contact-call',
  name: 'House sparrow · single chirp',
  category: 'Animals',
  tags: ['small', 'bird', 'songbird', 'sparrow', 'call', 'chirp', 'single', 'short', 'perched'],
  contains: ['one short natural house sparrow call'],
  components: ['sparrow call'],
  perspective: 'nearby perched bird',
  isolation: 'isolated',
  loopable: false,
  durationSec: 0.34,
  targetRmsDbfs: -26,
  mixRole: 'voice',
  recording: sparrow.credit,
  params: { pace: { label: 'Call pace', min: 0, max: 1, default: 0.5 } },
  render(ctx, { seed, params }) {
    const call = renderRecording(ctx, sparrow, { seed, speed: 0.96 + 0.08 * params.pace });
    return call.map(biquad('highpass', 1500, 0.7, ctx.sampleRate));
  },
} satisfies SoundRecipe;
