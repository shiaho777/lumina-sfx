import { sweepAudio } from './editor-sweep.ts';
import { biquad } from '../../engine/dsp.ts';
import { renderRecording, type RecordedClip } from '../../engine/recording.ts';
import type { RenderContext } from '../../engine/types.ts';

// A single recorded contact drives both the dry attack and the short resonance
// of the housing. The two share an onset even at rapid menu-navigation speeds.
export function seatedContact(ctx: RenderContext, source: RecordedClip, seed: number,
  pressure: number, bodyHz: number, cutoff: number, resonance: number) {
  const rate = ctx.sampleRate;
  const speed = .92 + .11 * pressure + .08 * ctx.random();
  const dry = renderRecording(ctx, source, {seed, speed, cutoffHz: Math.min(rate * .43, cutoff * (.76 + .39 * pressure))});
  const body = biquad('bandpass', bodyHz * speed, 1.15, rate);
  const damping = biquad('lowpass', bodyHz * 2.6, .7, rate);
  const delay = Math.max(2, Math.round(rate / (bodyHz * speed)));
  const ring = new Float32Array(delay);
  for (let i = 0; i < dry.length; i++) {
    const slot = i % delay;
    const response = body(dry[i]) + damping(ring[slot]) * resonance;
    ring[slot] = response;
    dry[i] = .62 * dry[i] + 1.18 * response;
  }
  return dry;
}

// Keep the grain of one continuous recording as the fictional movement builds and decays.
export function shapedPass(ctx: RenderContext, source: RecordedClip, seed: number, amount: number,
  apex: number, hz: number, speed: number) {
  const rate = ctx.sampleRate;
  const encoded = source.takes[(seed >>> 0) % source.takes.length];
  const bytes = encoded.length * .75 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  const seconds = bytes / (2 * source.sampleRate);
  const duration = ctx.frames / rate;
  const playback = Math.min(speed * (.95 + .09 * ctx.random()), seconds * .97 / duration);
  const startSec = Math.max(0, seconds - duration * playback) * ctx.random();
  const field = renderRecording(ctx, source, {seed, startSec, speed: playback, cutoffHz: Math.min(.43 * rate, hz * (1 + .54 * amount))});
  const low = biquad('lowpass', 330 + 260 * amount, .68, rate);
  const body = biquad('bandpass', hz * .30, .67, rate);
  for (let i = 0; i < field.length; i++) {
    const t = i / Math.max(1, field.length - 1);
    const rise = Math.min(1, t / apex);
    const tail = Math.max(0, (t - apex) / (1 - apex));
    const envelope = (.10 + .90 * rise * rise * (3 - 2 * rise)) * (1 - tail) ** 2;
    const x = field[i];
    field[i] = envelope * (.55 * x + body(x) * (.55 + .25 * amount) + low(x) * .93);
  }
  return field;
}

// Continuous band-limited air carries a screen transition; the short field
// transient passes at its original speed near the apex of the visual movement.
export function screenAir(ctx: RenderContext, seed: number, amount: number, apex: number,
  lowHz: number, highHz: number, reverse: boolean, grain?: RecordedClip) {
  return sweepAudio(ctx, amount, seed,
    {lowHz, highHz, grainHz: 4, grainDepth: .065, air: .028, body: 2.25},
    {duration: ctx.frames / ctx.sampleRate, apex, reverse, echo: .035}, grain);
}
