import { biquad, clamp, dbToGain, gainToDb, rng } from './dsp.ts';
export { biquad, clamp, dbToGain, gainToDb, rng };
export const TAU = Math.PI * 2;

export type SampleFilter = (x: number) => number;

// Band-limiting correction for a naive saw step. Subtract it from the naive wave at the wrap.
export function polyBlep(t: number, dt: number): number {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

export function sawOsc(rate: number, initialPhase = 0): (hz: number) => number {
  let phase = initialPhase;
  return (hz) => {
    const dt = hz / rate;
    const value = 2 * phase - 1 - polyBlep(phase, dt);
    phase += dt;
    if (phase >= 1) phase -= 1;
    return value;
  };
}

export function sineOsc(rate: number): (hz: number) => number {
  let phase = 0;
  return (hz) => {
    const value = Math.sin(TAU * phase);
    phase += hz / rate;
    if (phase >= 1) phase -= 1;
    return value;
  };
}

// Pulse wave with a duty cycle in (0, 1). A duty of 0.5 is a square.
export function pulseOsc(rate: number): (hz: number, width: number) => number {
  let phase = 0;
  return (hz, width) => {
    const dt = hz / rate;
    let edge = phase + width;
    if (edge >= 1) edge -= 1;
    const value = (2 * phase - 1 - polyBlep(phase, dt)) - (2 * edge - 1 - polyBlep(edge, dt));
    phase += dt;
    if (phase >= 1) phase -= 1;
    return value + 2 * width - 1;
  };
}

function triangleCorner(phase: number, step: number): number {
  const distance = Math.min(phase, 1 - phase);
  return distance < step ? (1 - distance / step) ** 3 : 0;
}

export function triangleOsc(rate: number): (hz: number) => number {
  let phase = 0;
  return (hz) => {
    const step = hz / rate;
    const half = phase < 0.5 ? phase + 0.5 : phase - 0.5;
    const value = 1 - 4 * Math.abs(phase - 0.5) +
      (4 * step / 3) * (triangleCorner(phase, step) - triangleCorner(half, step));
    phase += step;
    if (phase >= 1) phase -= 1;
    return value;
  };
}

// Level at release starts from whatever the attack or decay reached when the note was short.
export function adsrCurve(total: number, rate: number, hold: number, attack: number, decay: number, sustain: number, release: number): Float32Array {
  const out = new Float32Array(total);
  const a = Math.max(1, Math.round(attack * rate)), d = Math.max(1, Math.round(decay * rate)), r = Math.max(1, Math.round(release * rate));
  const held = Math.max(0, Math.min(hold, total));
  const level = (i: number) => (i < a ? i / a : i - a < d ? 1 - (1 - sustain) * ((i - a) / d) : sustain);
  const released = held ? level(held - 1) : 0;
  for (let i = 0; i < total; i++) {
    if (i < held) out[i] = level(i);
    else {
      const t = i - held;
      out[i] = t < r ? released * Math.exp((-7 * t) / r) * (1 - t / r) : 0;
    }
  }
  return out;
}

export interface SVF { low: number; band: number; high: number }

// Topology-preserving state-variable filter. It stays stable through fast resonant sweeps.
export function makeSVF(rate: number): (x: number, hz: number, q: number) => SVF {
  const out: SVF = { low: 0, band: 0, high: 0 };
  let ic1 = 0, ic2 = 0;
  return (x, hz, q) => {
    const g = Math.tan((Math.PI * clamp(hz, 5, rate * 0.24)) / rate);
    const k = 1 / Math.max(0.25, q);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out.low = v2;
    out.band = v1;
    out.high = x - k * v1 - v2;
    return out;
  };
}

export type Coefficients = readonly [b0: number, b1: number, b2: number, a0: number, a1: number, a2: number];

// RBJ cookbook designs, returned unnormalised so a meter can verify them against published values.
export function highShelfCoefficients(hz: number, q: number, gainDb: number, rate: number): Coefficients {
  const A = 10 ** (gainDb / 40), w0 = (TAU * Math.min(hz, rate * 0.45)) / rate;
  const cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), root = 2 * Math.sqrt(A) * alpha;
  return [
    A * ((A + 1) + (A - 1) * cos + root), -2 * A * ((A - 1) + (A + 1) * cos), A * ((A + 1) + (A - 1) * cos - root),
    A + 1 - (A - 1) * cos + root, 2 * ((A - 1) - (A + 1) * cos), A + 1 - (A - 1) * cos - root,
  ];
}

export function lowShelfCoefficients(hz: number, q: number, gainDb: number, rate: number): Coefficients {
  const A = 10 ** (gainDb / 40), w0 = (TAU * Math.min(hz, rate * 0.45)) / rate;
  const cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), root = 2 * Math.sqrt(A) * alpha;
  return [
    A * ((A + 1) - (A - 1) * cos + root), 2 * A * ((A - 1) - (A + 1) * cos), A * ((A + 1) - (A - 1) * cos - root),
    A + 1 + (A - 1) * cos + root, -2 * ((A - 1) + (A + 1) * cos), A + 1 + (A - 1) * cos - root,
  ];
}

export function highpassCoefficients(hz: number, q: number, rate: number): Coefficients {
  const w0 = (TAU * Math.min(hz, rate * 0.45)) / rate, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
  return [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
}

export function peakingCoefficients(hz: number, q: number, gainDb: number, rate: number): Coefficients {
  const A = 10 ** (gainDb / 40), w0 = (TAU * Math.min(hz, rate * 0.45)) / rate;
  const alpha = Math.sin(w0) / (2 * q), cos = Math.cos(w0);
  return [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
}

// Transposed direct form II keeps more precision than the direct form at low cutoffs.
export function filterFrom(c: Coefficients): SampleFilter {
  const n0 = c[0] / c[3], n1 = c[1] / c[3], n2 = c[2] / c[3], d1 = c[4] / c[3], d2 = c[5] / c[3];
  let z1 = 0, z2 = 0;
  return (x) => {
    const y = x * n0 + z1;
    z1 = x * n1 + z2 - d1 * y;
    z2 = x * n2 - d2 * y;
    return y;
  };
}

export const highShelf = (hz: number, q: number, gainDb: number, rate: number): SampleFilter => filterFrom(highShelfCoefficients(hz, q, gainDb, rate));
export const lowShelf = (hz: number, q: number, gainDb: number, rate: number): SampleFilter => filterFrom(lowShelfCoefficients(hz, q, gainDb, rate));
export const peaking = (hz: number, q: number, gainDb: number, rate: number): SampleFilter => filterFrom(peakingCoefficients(hz, q, gainDb, rate));

export function onePole(rate: number): (x: number, hz: number) => number {
  let y = 0, coeff = 1, lastHz = NaN;
  return (x, hz) => {
    if (hz !== lastHz) { coeff = 1 - Math.exp((-TAU * clamp(hz, 1, rate * 0.45)) / rate); lastHz = hz; }
    y += coeff * (x - y);
    return y;
  };
}

// tanh saturation with a level-compensated drive.
export function sat(x: number, drive: number): number {
  const k = 1 + 4 * drive;
  return Math.tanh(x * k) / Math.sqrt(k);
}

export const panGains = (pan: number): readonly [number, number] => {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

// Cyclic placement: a note whose tail passes the loop end continues at the start.
export function addWrapped(dest: Float32Array, source: Float32Array, start: number, gain = 1): void {
  const length = dest.length;
  let at = ((start % length) + length) % length;
  for (let i = 0; i < source.length; i++) {
    dest[at] += source[i] * gain;
    if (++at === length) at = 0;
  }
}

export function addClipped(dest: Float32Array, source: Float32Array, start: number, gain = 1): void {
  const from = Math.max(0, -start), to = Math.min(source.length, dest.length - start);
  for (let i = Math.max(0, from); i < to; i++) dest[start + i] += source[i] * gain;
}

export interface CompressorSettings {
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  kneeDb: number;
  makeupDb: number;
}

// Feed-forward peak compressor over a linked stereo pair. Returns the largest gain reduction in dB.
export function compress(left: Float32Array, right: Float32Array, rate: number, s: CompressorSettings): number {
  const attack = 1 - Math.exp(-1000 / (s.attackMs * rate)), release = 1 - Math.exp(-1000 / (s.releaseMs * rate));
  const slope = 1 - 1 / s.ratio, half = s.kneeDb / 2;
  let envelope = 0, gain = 1, worst = 0;
  for (let i = 0; i < left.length; i++) {
    const peak = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    envelope += (peak > envelope ? attack : release) * (peak - envelope);
    const over = 20 * Math.log10(Math.max(envelope, 1e-9)) - s.thresholdDb;
    let reduction = 0;
    if (over >= half) reduction = over * slope;
    else if (over > -half) reduction = (slope * (over + half) ** 2) / (2 * s.kneeDb);
    const target = dbToGain(s.makeupDb - reduction);
    gain += (target < gain ? attack : release) * (target - gain);
    left[i] *= gain;
    right[i] *= gain;
    if (reduction > worst) worst = reduction;
  }
  return worst;
}

export interface LimiterOptions {
  rate: number;
  ceiling: number; // linear sample peak
  lookaheadMs?: number;
  releaseMs?: number;
  loop?: boolean;
}

export interface LimitResult {
  gain: Float32Array;
  reductionDb: number; // largest gain reduction
  averageReductionDb: number;
}

// Look-ahead peak limiter. In loop mode the gain envelope is solved on a second pass around the
// cycle, so the start inherits the release that follows the end.
export function limit(left: Float32Array, right: Float32Array, o: LimiterOptions): LimitResult {
  const frames = left.length;
  const gain = new Float32Array(frames);
  if (!frames) return { gain, reductionDb: 0, averageReductionDb: 0 };
  const lookahead = Math.min(frames, Math.max(1, Math.round((o.lookaheadMs ?? 5) * o.rate / 1000)));
  const firstFrame = o.loop ? frames : 0;
  const endFrame = firstFrame + frames;
  const positions = new Float64Array(lookahead);
  const requiredGains = new Float64Array(lookahead);
  const release = 1 - Math.exp(-1000 / ((o.releaseMs ?? 90) * o.rate));
  const attack = 1 - Math.exp(-4.5 / lookahead);
  const requiredGain = (frame: number) => {
    const peak = Math.max(Math.abs(left[frame]), Math.abs(right[frame]));
    return peak > o.ceiling ? o.ceiling / peak : 1;
  };
  let head = 0, queued = 0, next = 0;
  let held = 1, smooth = 1, minimum = 1, totalReduction = 0;
  for (let i = 0; i < endFrame; i++) {
    if (queued && positions[head] < i) {
      head = (head + 1) % lookahead;
      queued--;
    }
    const windowEnd = o.loop ? i + lookahead : Math.min(i + lookahead, frames);
    while (next < windowEnd) {
      const required = requiredGain(next % frames);
      while (queued && requiredGains[(head + queued - 1) % lookahead] >= required) queued--;
      const tail = (head + queued) % lookahead;
      positions[tail] = next++;
      requiredGains[tail] = required;
      queued++;
    }
    const wanted = requiredGains[head];
    held = Math.min(wanted, held + release * (1 - held));
    const frame = i % frames;
    smooth = Math.min(smooth + attack * (held - smooth), requiredGain(frame));
    if (i >= firstFrame) {
      gain[frame] = smooth;
      minimum = Math.min(minimum, gain[frame]);
      if (gain[frame] < 1) totalReduction -= gainToDb(gain[frame]);
    }
  }
  for (let i = 0; i < frames; i++) {
    left[i] *= gain[i];
    right[i] *= gain[i];
  }
  return { gain, reductionDb: -gainToDb(minimum), averageReductionDb: totalReduction / frames };
}

interface FftTables { rev: Uint32Array; cos: Float64Array; sin: Float64Array }
const fftTables = new Map<number, FftTables>();

function tables(n: number): FftTables {
  let t = fftTables.get(n);
  if (!t) {
    const bits = Math.round(Math.log2(n));
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >>> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((-TAU * i) / n); sin[i] = Math.sin((-TAU * i) / n); }
    fftTables.set(n, (t = { rev, cos, sin }));
  }
  return t;
}

// In-place radix-2 FFT for power-of-two lengths. The inverse is not scaled.
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length, { rev, cos, sin } = tables(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k], wi = inverse ? -sin[k] : sin[k];
        const a = start + j, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}

export const hann = (n: number): Float64Array => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((TAU * i) / n));

// The decibel level of a sine sweep through a filter, for tests that need a measured response.
export function responseDb(filter: SampleFilter, hz: number, rate: number, seconds = 0.5): number {
  let sum = 0, count = 0;
  const total = Math.round(seconds * rate), skip = Math.round(0.1 * rate);
  for (let i = 0; i < total; i++) {
    const y = filter(Math.sin((TAU * hz * i) / rate));
    if (i >= skip) { sum += y * y; count++; }
  }
  return gainToDb(Math.sqrt(sum / Math.max(1, count)) * Math.SQRT2);
}
