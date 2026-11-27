import { biquad, clamp, mix, rng } from '../../engine/dsp.ts';
import { renderRecording } from '../../engine/recording.ts';
import type { RecordedClip } from '../../engine/recording.ts';
import type { RenderContext } from '../../engine/types.ts';

export type AcousticSpace = 'open' | 'passage' | 'interior' | 'basin' | 'screened' | 'underwater';
const reflections: Record<AcousticSpace, readonly [number, number, number][]> = {
  open: [[.043, .13, 3200], [.112, -.064, 1900]],
  passage: [[.017, .28, 5500], [.042, -.21, 4200], [.084, .17, 2800], [.171, .093, 1700]],
  interior: [[.008, .22, 4100], [.021, -.16, 3150], [.038, .19, 2800], [.067, .073, 2100]],
  basin: [[.091, .17, 2600], [.264, -.23, 1950], [.488, .14, 1350], [.762, .085, 880]],
  screened: [[.028, .19, 940], [.093, -.13, 740], [.153, .09, 530]],
  underwater: [[.023, .15, 410], [.127, -.15, 320]],
};

export function roomReturns(ctx: RenderContext, dry: Float32Array, space: AcousticSpace, side = 0) {
  const out = dry.slice();
  for (const [seconds, gain, cutoff] of reflections[space]) {
    const delay = Math.round(ctx.sampleRate * seconds * (1 + side * .12));
    const filter = biquad('lowpass', cutoff, .68, ctx.sampleRate);
    for (let i = 0; i + delay < dry.length; i++) out[i + delay] += filter(dry[i]) * gain;
  }
  return out;
}

export function snippet(ctx: RenderContext, clip: RecordedClip, seed: number, seconds: number, speed: number, hz: number, start = 0) {
  const frames = Math.max(1, Math.round(seconds * ctx.sampleRate));
  const signal = renderRecording({ ...ctx, frames }, clip, { seed, speed, cutoffHz: hz, startSec: start });
  const tail = Math.min(Math.round(ctx.sampleRate * .024), frames >> 2);
  for (let i = 0; i < tail; i++) signal[frames - 1 - i] *= i / tail;
  return signal;
}

// Each overlapping window follows real field audio. Random source offsets and
// nonuniform window lengths avoid an obvious repeated cycle in sustained beds.
export function sustain(ctx: RenderContext, clip: RecordedClip, seed: number, speed: number, hz: number, variedWindows = false) {
  const draw = rng(seed);
  const result = new Float32Array(ctx.frames);
  let offset = 0;
  let overlap = 0;
  for (let index = 0; offset < ctx.frames; index++) {
    const take = variedWindows ? Math.floor(draw() * clip.takes.length) : (seed + index) >>> 0;
    const encoded = clip.takes[take % clip.takes.length];
    const sourceSeconds = (encoded.length * .75 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0)) / (2 * clip.sampleRate);
    const stretch = speed * (.978 + .044 * draw());
    const length = Math.max(.009, sourceSeconds * (variedWindows ? .22 + .40 * draw() : .65 + .295 * draw()));
    const start = Math.max(0, (sourceSeconds - length) * draw());
    const frames = Math.max(1, Math.round(length / stretch * ctx.sampleRate));
    // A short preview may use only the opening of a long field take.
    const usedFrames = Math.min(frames, result.length - offset);
    const window = renderRecording({ ...ctx, frames: usedFrames }, clip, { seed: take, speed: stretch, startSec: start, cutoffHz: hz });
    const nextOverlap = Math.min(Math.round(.18 * ctx.sampleRate), frames >> 2);
    for (let i = 0; i < usedFrames; i++) {
      const fade = Math.min(overlap ? i / overlap : 1, nextOverlap ? (frames - i - 1) / nextOverlap : 1, 1);
      result[i + offset] += window[i] * Math.sin(Math.PI * .5 * fade);
    }
    offset += Math.max(1, frames - nextOverlap);
    overlap = nextOverlap;
  }
  return result;
}

export function place(dst: Float32Array, src: Float32Array, seconds: number, gain: number, rate: number) {
  mix(dst, src, gain, Math.round(seconds * rate));
}

export function unit(value: number) { return clamp(value, 0, 1); }
