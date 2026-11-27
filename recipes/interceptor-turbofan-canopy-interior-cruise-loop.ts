import type { SoundRecipe } from '../engine/types.ts';
import { biquad } from '../engine/dsp.ts';
import { renderRecording } from '../engine/recording.ts';
import core from './_recordings/isolated-turbine-core.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-demo-turbine-idle.ts';
import loaded from './_recordings/isolated-demo-fighter-rise.ts';

export default {
  soloQueries: [
    'cockpit',
    'cockpit engine',
    'jet cockpit',
    'inside a cockpit',
    'dry cockpit',
    'cockpit ambience',
  ],
  isolation: 'isolated',
  components: ['jet-engine'],
  id: 'interceptor-turbofan-canopy-interior-cruise-loop',
  name: 'Interceptor turbofan canopy interior cruise loop',
  category: 'Aircraft',
  tags: [
    'aircraft',
    'jet',
    'engine',
    'cabin',
    'interceptor',
    'turbofan',
    'canopy',
    'interior',
    'cruise',
    'loop',
  ],
  loopable: true,
  sustainMode: 'evolving',
  durationSec: 4.19,
  targetRmsDbfs: -25,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: 0.5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: 0.55 },
  },
  ...sceneCredits(idle, loaded, core),
  render(ctx, { seed, params }) {
    const wash = propulsion(
      ctx,
      seed,
      params.intensity,
      params.rpm,
      'cabin',
      {
        kind: 'jet',
        pulseHz: [180, 760],
        timbre: 0.91,
        idleWindow: [0.23, 0.93],
        powerWindow: [0.22, 0.91],
      },
      idle,
      loaded,
    );
    // Keep the brief, steady engine performance. An overlapping wrap avoids a
    // repeated attack while the independently varying broadband rumble continues.
    const rate = ctx.sampleRate;
    const speed = 0.86 + 0.25 * params.rpm;
    const length = Math.floor((rate * 1.52) / speed);
    const corePcm = renderRecording({ ...ctx, frames: length }, core, {
      speed,
      cutoffHz: 1700 + 1400 * params.intensity,
    });
    // A close takeoff gets louder across the microphone. For held cruise, remove
    // that pass-by contour once, before repeating the steady portion.
    const power = new Float64Array(length + 1);
    for (let i = 0; i < length; i++) power[i + 1] = power[i] + corePcm[i] ** 2;
    const radius = Math.round(0.072 * rate),
      rms = Math.sqrt(power[length] / length);
    for (let i = 0; i < length; i++) {
      const lo = Math.max(0, i - radius),
        hi = Math.min(length, i + radius + 1);
      const local = Math.sqrt((power[hi] - power[lo]) / (hi - lo));
      corePcm[i] *= Math.min(2, Math.max(0.24, (rms / Math.max(0.012, local)) ** 0.82));
    }
    // Alternate overlapping windows from different points in the steady core. The
    // source's microscopic blade texture survives without replaying its pass-by envelope.
    const bed = new Float32Array(ctx.frames);
    let start = 0,
      overlap = 0;
    while (start < bed.length) {
      const span = Math.round((0.38 + 0.29 * ctx.random()) * rate);
      const next = Math.round((0.11 + 0.065 * ctx.random()) * rate);
      const source = Math.floor(ctx.random() * (length - span - 1));
      const count = Math.min(span, bed.length - start);
      for (let j = 0; j < count; j++) {
        const fade = Math.min(1, overlap ? j / overlap : 1, (span - j) / next);
        bed[start + j] += corePcm[source + j] * Math.sin(fade * Math.PI * 0.5);
      }
      start += span - next;
      overlap = next;
    }
    const structure = biquad('lowpass', 1300 + params.rpm * 440, 0.68, rate);
    const induction = biquad('bandpass', 890 + params.rpm * 330, 1.7, rate);
    const shaftHz = 420 + 300 * params.rpm;
    let phase = ctx.random() * 2 * Math.PI,
      trim = 1,
      demanded = 1,
      next = 0;
    const glide = 1 - Math.exp(-1 / (0.82 * rate));
    for (let i = 0; i < bed.length; i++) {
      if (i >= next) {
        demanded = 0.992 + 0.016 * ctx.random();
        next = i + Math.round((0.9 + 2.4 * ctx.random()) * rate);
      }
      trim += (demanded - trim) * glide;
      phase = (phase + (2 * Math.PI * shaftHz * trim) / rate) % (2 * Math.PI);
      const core = bed[i];
      // Two quiet blade orders stay coupled to shaft speed under the recorded intake wash.
      const blades = 0.0075 * Math.sin(phase) + 0.0026 * Math.sin(phase * 2);
      bed[i] = 0.23 * wash[i] + 0.68 * core + 0.54 * structure(core) + 0.28 * induction(core) + blades;
    }
    return bed;
  },
} satisfies SoundRecipe;
