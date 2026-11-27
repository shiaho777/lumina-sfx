import type { SoundRecipe } from '../engine/types.ts';
import { woodFire } from './_shared/wood-fire.ts';
import { biquad } from '../engine/dsp.ts';
import hearth from './_recordings/isolated-hearth-wood.ts';
import burn from './_recordings/isolated-wood-flame.ts';

export default {
  id: 'campfire-crackle-loop',
  name: 'Campfire · steady wood flame',
  category: 'Weather & Ambience',
  tags: ['campfire', 'fire', 'embers', 'wood', 'flame', 'small', 'hearth', 'quiet', 'soft', 'crackle', 'loop'],
  soloQueries: ['fire', 'campfire', 'wood fire', 'quiet fire', 'fire crackle', 'campfire crackle'],
  components: ['fire'],
  contains: ['small wood fire burning steadily with quiet ember crackle'],
  isolation: 'isolated',
  loopable: true,
  sustainMode: 'evolving',
  durationSec: 7,
  mixRole: 'ambience',
  recording: burn.credit,
  additionalRecordings: [hearth.credit],
  params: { sparks: { label: 'Wood snap presence', min: 0, max: 1, default: 0.32 } },
  render(ctx, { params, seed }) {
    const bed = woodFire(ctx, burn, seed, params.sparks * 0.73, 0.61, 'open', 'steady', 0.49, true);
    const coals = woodFire(
      ctx,
      hearth,
      seed ^ 0x529bd17,
      params.sparks * 0.55,
      0.48,
      'open',
      'steady',
      0.36,
      true,
    );
    const mellow = biquad('lowpass', 2400, 0.69, ctx.sampleRate);
    const low = biquad('lowpass', 660, 0.7, ctx.sampleRate);
    let activity = 0.45,
      target = 0.45,
      next = 0;
    const glide = 1 - Math.exp(-1 / (ctx.sampleRate * 0.55));
    for (let i = 0; i < bed.length; i++) {
      if (i >= next) {
        target = 0.28 + 0.38 * ctx.random();
        next = i + Math.round((1.1 + ctx.random() * 4.7) * ctx.sampleRate);
      }
      activity += (target - activity) * glide;
      const warm = mellow(bed[i]);
      const body = low(warm),
        edge = warm - body;
      bed[i] = body + 0.16 * Math.tanh(edge * 4.5) + (coals[i] - body * 0.22) * activity;
    }
    return bed;
  },
} satisfies SoundRecipe;
