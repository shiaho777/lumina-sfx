import { biquad, noise, rng } from '../../engine/dsp.ts';
import type { RecordedClip } from '../../engine/recording.ts';
import type { RenderContext } from '../../engine/types.ts';
import { place, roomReturns, snippet, sustain, unit } from './field-layers.ts';
import type { AcousticSpace } from './field-layers.ts';

export type WeatherMovement = 'scattered' | 'steady' | 'surge' | 'retreat';
export interface WeatherSite {
  base: RecordedClip;
  singlePerformance?: boolean;
  discreteDrops?: boolean;
  wash: RecordedClip;
  detail: RecordedClip;
  bodyHz: number;
  detailHz: number;
  spacing: number;
  depth: number;
  space: AcousticSpace;
}

export function fieldWeather(ctx: RenderContext, seed: number, intensity: number, site: WeatherSite, movement: WeatherMovement) {
  const draw = rng(seed ^ 0x45a2c3);
  const duration = ctx.frames / ctx.sampleRate;
  const base = sustain(ctx, site.base, seed, .97, site.bodyHz);
  if (site.discreteDrops) {
    // Reuse actual material attacks. Pick the strongest onset in each random
    // neighbourhood and retain its short decay, with quiet between drops.
    const result = new Float32Array(ctx.frames);
    const window = Math.round(.062 * ctx.sampleRate);
    const period = Math.min(ctx.loopFrames ?? ctx.frames, ctx.frames);
    for (let at = Math.round(.008 * ctx.sampleRate); at + window < period;) {
      const start = Math.floor(draw() * Math.max(1, base.length - 3 * window));
      let onset = start;
      let strongest = 0;
      for (let j = start + 1; j < start + window; j++) {
        const change = Math.abs(base[j] - base[j - 1]);
        if (change > strongest) { onset = j; strongest = change; }
      }
      const gain = .35 + .65 * draw();
      const ingress = Math.round(.0015 * ctx.sampleRate);
      const from = Math.max(0, onset - ingress);
      for (let k = 0; k < window && at + k < result.length; k++) {
        result[at + k] += (base[from + k] ?? 0) * gain * Math.min(1, k / ingress) * Math.exp(-4 * k / window);
      }
      at += Math.max(window >> 1, Math.round(ctx.sampleRate * site.spacing *
        (.12 + .60 * draw() ** 2) / (.65 + intensity)));
    }
    // The last drop decays before the next cycle. Pass its real continuation
    // to the runtime so the crossfade keeps exactly one set of arrivals.
    for (let i = period; i < result.length; i++) result[i] = result[i % period];
    // Soften the ring according to the struck material.
    return result.map(biquad('lowpass', Math.min(site.detailHz * .62, 4200), .67, ctx.sampleRate));
  }
  const oneWash = site.singlePerformance && site.base === site.wash;
  const oneDetail = site.singlePerformance && (site.detail === site.base || site.detail === site.wash);
  const wash = oneWash ? base : sustain(ctx, site.wash, seed ^ 0x9134a, .90 + .13 * intensity, site.detailHz);
  const accents = new Float32Array(ctx.frames);
  const spacing = site.spacing * (movement === 'scattered' ? 1.55 : movement === 'steady' ? .85 : 1);
  for (let t = draw() * spacing; !oneDetail && t < duration; t += spacing * (.34 + draw() * 1.31) / (.58 + intensity)) {
    const length = Math.min(.62, spacing * (.21 + .4 * draw()));
    const grain = snippet(ctx, site.detail, Math.floor(draw() * 2147483647), length, .87 + draw() * .24, site.detailHz, draw() * .065);
    const rise = Math.min(grain.length, Math.max(3, Math.round(ctx.sampleRate * Math.min(.013, length * .13))));
    for (let i = 0; i < rise; i++) grain[i] *= i / rise;
    place(accents, grain, t, .27 + .48 * draw(), ctx.sampleRate);
  }
  const position = draw() * 6.28;
  const depth = site.depth;
  const cover = { open: 0, basin: .06, passage: .12, interior: .21, screened: .42, underwater: .59 }[site.space];
  const muffled = biquad('lowpass', site.space === 'underwater' ? 340 : 1150, .73, ctx.sampleRate);
  for (let i = 0; i < base.length; i++) {
    const x = i / base.length;
    const tide = .5 - .5 * Math.cos(2 * Math.PI * x);
    const ripple = Math.sin(position + x * 6.283) * .065 + Math.sin(position * 2 + x * 12.566) * .032;
    let amount = .5;
    if (movement === 'scattered') amount = .14 + .18 * tide;
    if (movement === 'steady') amount = .60 + .13 * tide;
    if (movement === 'surge') amount = .10 + .87 * x * x;
    if (movement === 'retreat') amount = .05 + .92 * (1 - x) ** 2;
    const blend = unit(.60 * amount + .40 * intensity + ripple);
    const near = oneWash ? base[i] * (.64 + .48 * blend) : base[i] * Math.cos(blend * 1.39) + wash[i] * Math.sin(blend * 1.39) * (depth + .36);
    const direct = near + accents[i] * (.21 + .54 * blend);
    base[i] = direct * (1 - cover) + muffled(direct) * cover;
    if (movement === 'surge' || movement === 'retreat') {
      base[i] *= (.49 + .67 * amount) * Math.min(1, (1 - x) * duration * 10);
    }
  }
  return base;
}

export interface StormPath {
  space: AcousticSpace;
  cutoff: number;
  rolls: readonly number[];
  decay: number;
  width: number;
}

export function thunderChannel(ctx: RenderContext, seed: number, distance: number, storm: StormPath,
  strike: RecordedClip, tail: RecordedClip, side: -1 | 0 | 1) {
  const draw = rng(seed);
  const diffuse = rng((seed + (side + 1) * 22697) >>> 0);
  const out = new Float32Array(ctx.frames);
  const hz = storm.cutoff / (1 + distance * 1.5);
  const front = snippet(ctx, strike, seed, Math.min(3.8, ctx.frames / ctx.sampleRate), .97 + .055 * draw(), hz);
  place(out, front, 0, .83, ctx.sampleRate);
  for (const [index, at] of storm.rolls.entries()) {
    const length = storm.decay * (1 - .085 * index);
    const variation = .88 + .16 * draw();
    const ripple = Math.max(0, at + side * storm.width * (.15 + .11 * index));
    const part = snippet(ctx, tail, seed + index, length, (.81 + .11 * draw()) * variation, Math.min(hz, 1200) / (1 + .42 * index), .13 * index);
    const air = noise(diffuse, 'brown');
    const earth = biquad('lowpass', 76 - Math.min(index * 5, 26), .88, ctx.sampleRate);
    const drift = 1.4 + draw() * 1.4;
    for (let i = 0; i < part.length; i++) {
      const t = i / ctx.sampleRate;
      const swell = Math.min(1, t / (.022 + index * .048)) * Math.exp(-t / (length * .34));
      const rolling = .62 + .38 * Math.sin(t * drift + index * .93) ** 2;
      part[i] = (part[i] * (.86 - index * .07) + earth(air()) * 1.62) * rolling * swell;
    }
    place(out, part, ripple, 1.32 * variation / (1 + index * .38), ctx.sampleRate);
  }
  return roomReturns(ctx, out, storm.space, side);
}
