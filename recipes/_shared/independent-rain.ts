import { biquad, noise } from '../../engine/dsp.ts';
import { renderRecording } from '../../engine/recording.ts';
import type { RenderContext } from '../../engine/types.ts';
import drops from '../_recordings/isolated-canopy-droplets.ts';

export function independentRain(ctx: RenderContext, intensity: number, canopy: boolean, drizzle = false) {
  const { sampleRate: rate, frames, random } = ctx;
  const out = new Float32Array(frames),
    white = noise(random, 'white'),
    pink = noise(random, 'pink');
  const wash = biquad('bandpass', canopy ? 1170 : 2300, 0.65, rate),
    air = biquad('highpass', 4100, 0.6, rate);
  const shelter = biquad('lowpass', canopy ? 3200 : 9500, 0.6, rate);
  let gust = 0.55,
    target = 0.55,
    change = 0;
  const relax = 1 - Math.exp(-1 / (rate * 0.37));
  for (let i = 0; i < frames; i++) {
    if (i >= change) {
      target = 0.33 + 0.47 * random();
      change = i + Math.round((0.27 + 0.76 * random()) * rate);
    }
    gust += (target - gust) * relax;
    const n = white();
    out[i] = shelter(
      (0.19 * wash(n) + 0.1 * pink() + 0.12 * air(n)) * (0.4 + 0.6 * intensity) * (0.73 + 0.29 * gust),
    );
  }
  if (drizzle) for (let i = 0; i < frames; i++) out[i] *= .14;
  // Independent arrivals. A few large drops have weight without making a rhythmic typewriter.
  const arrivals = drizzle ? 10 + 18 * intensity : canopy ? 24 + 55 * intensity : 65 + 100 * intensity;
  for (let at = 0; at < frames;) {
    const take = random(),
      weight = random() ** 2;
    const length = Math.round(0.105 * rate),
      speed = 0.78 + 0.45 * random();
    const drop = renderRecording({ ...ctx, frames: length }, drops, {
      seed: Math.floor(take * drops.takes.length),
      speed,
      cutoffHz: drizzle ? 3300 + 1100 * weight : canopy ? 2650 + 1000 * weight : 6000,
    });
    const g = (0.28 + weight * 0.8) * (canopy ? 0.92 : 0.57);
    for (let j = 0; j < drop.length && at + j < frames; j++) out[at + j] += g * drop[j];
    at += Math.max(1, Math.round((-Math.log(Math.max(1e-9, 1 - random())) * rate) / arrivals));
  }
  return out;
}
