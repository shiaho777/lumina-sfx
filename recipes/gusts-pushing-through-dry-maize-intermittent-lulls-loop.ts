import type { SoundRecipe } from '../engine/types.ts';
import { place, snippet, sustain } from './_shared/field-layers.ts';
import { biquad } from '../engine/dsp.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-field-corn-rustle.ts';
import rubbingLeaf from './_recordings/isolated-wind-leaf.ts';
import leaves from './_recordings/isolated-dry-maize-leaf.ts';

export default {
  id: 'gusts-pushing-through-dry-maize-intermittent-lulls-loop',
  name: 'Gusts pushing through dry maize — intermittent lulls',
  category: 'Weather & Ambience',
  tags: ['wind', 'field-recording', 'open', 'intermittent lulls', 'gusts', 'pushing', 'through', 'dry'],
  loopable: true,
  durationSec: 6.99,
  isolation: 'isolated',
  components: ['wind'],
  sustainMode: 'evolving',
  mixRole: 'ambience',
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.23 } },
  ...sceneCredits(leaves, rubbingLeaf),
  render(ctx, { seed, params }) {
    // The moving leaves carry the gust. Retain their individual brittle rubs;
    // a quiet stationary bed fills the intervals between neighbouring stalks.
    const body = sustain(ctx, source, seed, 0.95, 2300, true);
    const leaf = sustain(ctx, leaves, seed + 17, 1.01, 7900);
    const rustles = new Float32Array(ctx.frames);
    for (
      let at = ctx.random() * 0.28;
      at < ctx.frames / ctx.sampleRate;
      at += 0.19 + ctx.random() ** 1.6 * 0.82
    ) {
      const length = 0.07 + 0.13 * ctx.random();
      const flick = snippet(
        ctx,
        rubbingLeaf,
        Math.floor(ctx.random() * 2147483647),
        length,
        0.9 + 0.2 * ctx.random(),
        7600,
        0.04 + ctx.random() * 0.16,
      );
      const rise = Math.max(1, Math.round(ctx.sampleRate * 0.012));
      for (let j = 0; j < Math.min(rise, flick.length); j++) flick[j] *= j / rise;
      place(rustles, flick, at, 0.33 + 0.38 * ctx.random(), ctx.sampleRate);
    }
    const papery = biquad('highpass', 780, 0.72, ctx.sampleRate);
    let pressure = 0.35,
      target = 0.4,
      next = 0;
    for (let i = 0; i < body.length; i++) {
      if (i >= next) {
        target = 0.12 + (0.4 + 0.45 * params.intensity) * ctx.random();
        next = i + Math.round(ctx.sampleRate * (0.27 + ctx.random() * 1.48));
      }
      pressure += (target - pressure) * (0.85 / ctx.sampleRate) * 6;
      body[i] = body[i] * 0.09 + pressure * (0.65 * papery(leaf[i]) + 0.17 * leaf[i] + rustles[i]);
    }
    return body;
  },
} satisfies SoundRecipe;
