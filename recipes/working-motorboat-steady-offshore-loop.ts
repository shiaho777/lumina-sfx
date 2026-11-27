import type { SoundRecipe } from '../engine/types.ts';
import { biquad } from '../engine/dsp.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-motion-marine-engine.ts';
import loaded from './_recordings/isolated-motion-outboard-aeration.ts';

export default {
  isolation: 'isolated',
  perspective: 'above water',
  contains: ['steady motor heard offshore'],
  markers: { handoff: 1.48 },
  id: 'working-motorboat-steady-offshore-loop',
  name: 'Working motorboat steady offshore loop',
  category: 'Water & Fire',
  tags: ['cruise', 'working', 'motorboat', 'steady', 'offshore', 'boat', 'marine'],
  loopable: true,
  sustainMode: 'evolving',
  durationSec: 6.25,
  targetRmsDbfs: -29,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: 'vehicle',
  ...sceneCredits(idle, loaded),
  render(ctx, { params, seed }) {
    const recording = propulsion(
      ctx,
      seed,
      params.intensity,
      0.5,
      'cruise',
      {
        kind: 'outboard',
        pulseHz: [27, 135],
        timbre: 0.53,
        idleWindow: [0.1, 0.9],
        powerWindow: [0.28, 0.81],
      },
      idle,
      loaded,
    );
    const hull = biquad('lowpass', 1250 + 800 * params.intensity, 0.73, ctx.sampleRate);
    const exhaust = biquad('bandpass', 93 + 24 * params.intensity, 1.05, ctx.sampleRate);
    let phase = ctx.random(),
      speed = 1,
      load = 1,
      next = 0;
    const glide = 1 - Math.exp(-1 / (0.21 * ctx.sampleRate));
    for (let i = 0; i < recording.length; i++) {
      if (i >= next) {
        load = 0.97 + 0.06 * ctx.random();
        next = i + Math.round((0.37 + ctx.random() * 1.23) * ctx.sampleRate);
      }
      speed += (load - speed) * glide;
      phase = (phase + ((21 + 11 * params.intensity) * speed) / ctx.sampleRate) % 1;
      // Uneven exhaust beats through the hull; the wake stays in the source recording.
      const pulse = Math.max(0, Math.cos(phase * 2 * Math.PI)) ** 4;
      const sample = recording[i];
      recording[i] = hull(sample) * (0.78 + 0.29 * pulse) + 0.21 * sample + exhaust(pulse - 0.1875) * 0.065;
    }
    return recording;
  },
} satisfies SoundRecipe;
