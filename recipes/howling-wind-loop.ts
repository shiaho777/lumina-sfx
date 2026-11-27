import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';
import type { SoundRecipe } from '../engine/types.ts';
import { biquad, noise, renderSamples, TAU } from '../engine/dsp.ts';

const original = {
  id: 'howling-wind-loop', name: "Eerie Howling Wind", category: 'Weather & Ambience',
  tags: ["wind","howl","eerie","ambience","loop"], loopable: true, sustainMode: 'evolving', durationSec: 8,
  params: { howl: { label: 'Howl', min: 0, max: 1, default: 0.71 } },
  render(ctx, { params }) {
    const wind = noise(ctx.random, 'pink');
    const wind2 = noise(ctx.random, 'brown');
    const throat = biquad('bandpass', 278, 1.8, ctx.sampleRate);
    const whistle = biquad('bandpass', 790, 3.8, ctx.sampleRate);
    const bottom = biquad('lowpass', 195, 0.72, ctx.sampleRate);
    return renderSamples(ctx, (t) => {
      const phase = TAU * t / 8;
      const gust = (0.54 + 0.29 * Math.sin(phase * 3 + 0.38) + 0.17 * Math.cos(phase * 7)) ** 1.7;
      const a = Math.sin(TAU * 156 * t + 4 * Math.sin(phase * 3) + 6 * Math.cos(phase * 2));
      const b = Math.sin(TAU * 259 * t + 6 * Math.sin(phase * 4));
      const air = wind();
      return 0.95 * bottom(wind2()) + (2.7 * throat(air) + 0.8 * whistle(air)) * (0.54 + gust)
        + params.howl * gust * (0.36 * a + 0.18 * b);
    });
  },
} satisfies SoundRecipe;

export default {
  ...original, isolation:'isolated', components:['wind'],
  ...sceneCredits(source),
  render(ctx, opts) {
    const old = original.render(ctx, opts);
    const field = fieldWeather(ctx, opts.seed, opts.params.howl, {
      base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 3650, detailHz: 4900, spacing: 2.01, depth: 0.68, space: "open",
    }, "steady");
    return field.map((v, i) => v * .81 + old[i] * .16);
  },
} satisfies SoundRecipe;
