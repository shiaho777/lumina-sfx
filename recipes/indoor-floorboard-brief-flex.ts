import { biquad } from '../engine/dsp.ts';
import type { SoundRecipe } from '../engine/types.ts';

export default {
  id: 'indoor-floorboard-brief-flex',
  name: 'Quiet indoor floorboard creak under weight',
  category: 'Props & Interactions',
  tags: ['floorboard', 'floor', 'creak', 'wood', 'indoor', 'short', 'quiet'],
  contains: ['brief wood flex'],
  perspective: 'at floor level',
  loopable: false,
  isolation: 'isolated',
  durationSec: 0.34,
  mixRole: 'detail',
  targetRmsDbfs: -32,
  params: { load: { label: 'Board load', min: 0, max: 1, default: 0.42 } },
  render(ctx, { params }) {
    const rate = ctx.sampleRate;
    const plank = biquad('bandpass', 230 + 45 * ctx.random(), 1.6, rate);
    const joint = biquad('bandpass', 680 + 120 * ctx.random(), 2.2, rate);
    const friction = biquad('lowpass', 1520, 0.72, rate);
    const hold = 0.145 + 0.075 * params.load;
    let phase = 0.91,
      slip = 0.25,
      jitter = 1;
    return Float32Array.from({ length: ctx.frames }, (_, i) => {
      const t = i / rate;
      const strain = Math.min(1, t / 0.085) * Math.exp(-Math.max(0, t - hold) / 0.055);
      // A loaded joint slips faster as pressure rises, then relaxes back into the board.
      phase += ((57 + (76 + 68 * params.load) * strain) * jitter) / rate;
      if (phase >= 1) {
        phase -= 1;
        slip = 0.65 + 0.35 * ctx.random();
        jitter = 0.79 + 0.39 * ctx.random();
      }
      slip *= Math.exp(-1 / (rate * 0.0028));
      const rubbing = friction((ctx.random() - 0.5) * 0.105 + slip);
      return (0.09 * Math.exp(-t / 0.015) + strain) * (1.1 * plank(rubbing) + 0.52 * joint(rubbing));
    });
  },
} satisfies SoundRecipe;
