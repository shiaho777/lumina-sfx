// Measurements that stand in for ears: loudness, true peak, spectrum and stereo image.
import { fft, filterFrom, gainToDb, hann, highpassCoefficients, type Coefficients, type SampleFilter } from './signal.ts';

const LUFS_OFFSET = -0.691;
const lufs = (power: number): number => LUFS_OFFSET + 10 * Math.log10(Math.max(power, 1e-24));
const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

// The high shelf in the form behind the published BS.1770 reference coefficients.
function presenceShelf(rate: number): Coefficients {
  const k = Math.tan((Math.PI * 1681.974450955533) / rate), q = 0.7071752369554196;
  const vh = 10 ** (3.99984385397 / 20), vb = vh ** 0.4996667741545416, a0 = 1 + k / q + k * k;
  return [
    (vh + (vb * k) / q + k * k) / a0, (2 * (k * k - vh)) / a0, (vh - (vb * k) / q + k * k) / a0,
    1, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0,
  ];
}

// ITU-R BS.1770-4 K-weighting: a +4 dB high shelf above the presence band and a 38 Hz high-pass.
export function kWeightingCoefficients(rate: number): [Coefficients, Coefficients] {
  return [presenceShelf(rate), highpassCoefficients(38.13547087602444, 0.5003270373238773, rate)];
}

export function kWeighting(rate: number): [SampleFilter, SampleFilter] {
  const [shelf, highpass] = kWeightingCoefficients(rate);
  return [filterFrom(shelf), filterFrom(highpass)];
}

export interface Loudness {
  integrated: number; // LUFS
  momentaryMax: number;
  shortTermMax: number;
  lra: number; // loudness range in LU
}

function percentile(sorted: readonly number[], fraction: number): number {
  const at = fraction * (sorted.length - 1), low = Math.floor(at);
  return sorted[low] + (sorted[Math.min(sorted.length - 1, low + 1)] - sorted[low]) * (at - low);
}

export function measureLoudness(channels: readonly Float32Array[], rate: number): Loudness {
  const silent: Loudness = { integrated: -Infinity, momentaryMax: -Infinity, shortTermMax: -Infinity, lra: 0 };
  const length = channels[0]?.length ?? 0;
  if (!length) return silent;
  const cumulative = new Float64Array(length + 1);
  for (const channel of channels) {
    const [shelf, highpass] = kWeighting(rate);
    for (let i = 0; i < length; i++) {
      const y = highpass(shelf(channel[i]));
      cumulative[i + 1] += y * y;
    }
  }
  for (let i = 1; i <= length; i++) cumulative[i] += cumulative[i - 1];
  const power = (start: number, count: number) => (cumulative[start + count] - cumulative[start]) / count;
  const windows = (seconds: number, hopSeconds: number): number[] => {
    const block = Math.round(seconds * rate), hop = Math.round(hopSeconds * rate);
    if (length <= block) return [power(0, length)];
    const out: number[] = [];
    for (let start = 0; start + block <= length; start += hop) out.push(power(start, block));
    return out;
  };
  const momentary = windows(0.4, 0.1), shortTerm = windows(3, 1);
  const audible = momentary.filter((value) => lufs(value) > -70);
  if (!audible.length) return silent;
  // The relative gate discards everything 10 LU below the blocks that passed the absolute gate.
  const threshold = lufs(mean(audible)) - 10;
  const gated = momentary.filter((value) => lufs(value) > -70 && lufs(value) > threshold);
  const shortLoud = shortTerm.map(lufs);
  const shortAudible = shortTerm.filter((value) => lufs(value) > -70);
  let lra = 0;
  if (shortAudible.length) {
    const floor = lufs(mean(shortAudible)) - 20;
    const kept = shortLoud.filter((value) => value > -70 && value > floor).sort((a, b) => a - b);
    if (kept.length) lra = Math.max(0, percentile(kept, 0.95) - percentile(kept, 0.1));
  }
  return {
    integrated: lufs(mean(gated)),
    momentaryMax: Math.max(...momentary.map(lufs)),
    shortTermMax: Math.max(...shortLoud),
    lra,
  };
}

export function samplePeakDb(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
  return gainToDb(peak);
}

export function rmsDb(channel: Float32Array, from = 0, to = channel.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += channel[i] * channel[i];
  return gainToDb(Math.sqrt(sum / Math.max(1, to - from)));
}

export function dcOffset(channel: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < channel.length; i++) sum += channel[i];
  return sum / Math.max(1, channel.length);
}

let cachedTaps: Float64Array | undefined;

function bessel0(x: number): number {
  let sum = 1, term = 1;
  for (let k = 1; k < 40; k++) { term *= x / 2 / k; sum += term * term; }
  return sum;
}

// A 128-tap Kaiser windowed sinc, split into four polyphase branches of 32 taps.
// The passband stays within 0.02 dB up to 0.82 of Nyquist and the images start at Nyquist.
const OVERSAMPLE_PHASES = 4;
const TAPS_PER_PHASE = 32;

export function oversamplingTaps(): Float64Array {
  if (cachedTaps) return cachedTaps;
  const count = OVERSAMPLE_PHASES * TAPS_PER_PHASE, mid = (count - 1) / 2, cutoff = 0.235, beta = 5, norm = bessel0(beta);
  const taps = new Float64Array(count);
  let sum = 0;
  for (let k = 0; k < count; k++) {
    const x = (k - mid) / mid;
    const sinc = k === mid ? 1 : Math.sin(Math.PI * cutoff * (k - mid)) / (Math.PI * cutoff * (k - mid));
    taps[k] = (cutoff * sinc * bessel0(beta * Math.sqrt(Math.max(0, 1 - x * x)))) / norm;
    if (k % OVERSAMPLE_PHASES === 0) sum += taps[k];
  }
  for (let k = 0; k < count; k++) taps[k] /= sum;
  return (cachedTaps = taps);
}

// Highest inter-sample peak in dBTP. Quiet windows are skipped because a peak cannot exceed its
// neighbouring samples by much, and each local maximum is refined with a parabola between grid points.
export function truePeakDb(channels: readonly Float32Array[]): number {
  const taps = oversamplingTaps(), width = TAPS_PER_PHASE, phases = OVERSAMPLE_PHASES;
  let highest = 0;
  for (const channel of channels) {
    const length = channel.length;
    if (!length) continue;
    let samplePeak = 0;
    for (let i = 0; i < length; i++) samplePeak = Math.max(samplePeak, Math.abs(channel[i]));
    highest = Math.max(highest, samplePeak);
    const hot = samplePeak * 0.6;
    const prefix = new Float32Array(length), suffix = new Float32Array(length);
    for (let i = 0; i < length; i++) prefix[i] = i % width === 0 ? Math.abs(channel[i]) : Math.max(prefix[i - 1], Math.abs(channel[i]));
    for (let i = length - 1; i >= 0; i--) suffix[i] = i % width === width - 1 || i === length - 1 ? Math.abs(channel[i]) : Math.max(suffix[i + 1], Math.abs(channel[i]));
    // grid[0] carries the previous sample's last grid point so triples straddle sample boundaries.
    const grid = new Float64Array(phases + 1);
    let filled = false;
    // The filter delays its output by its own length, so the sweep runs past the end of the signal.
    for (let n = 0; n < length + width; n++) {
      const last = Math.min(n, length - 1), from = Math.max(0, last - width + 1);
      if (Math.max(suffix[from], prefix[last]) < hot) { filled = false; continue; }
      if (filled) grid[0] = grid[phases];
      for (let phase = 0; phase < phases; phase++) {
        let value = 0;
        for (let j = Math.max(0, n - length + 1); j <= Math.min(n, width - 1); j++) value += taps[phase + phases * j] * channel[n - j];
        const magnitude = Math.abs(value);
        if (magnitude > highest) highest = magnitude;
        grid[phase + 1] = value;
      }
      for (let k = filled ? 0 : 1; k < phases; k++) {
        const a = grid[k], b = grid[k + 1], c = grid[k + 2];
        const middle = Math.abs(b);
        if (middle < Math.abs(a) || middle < Math.abs(c)) continue;
        const sign = b < 0 ? -1 : 1, curved = (a - 2 * b + c) * sign;
        if (curved < 0) highest = Math.max(highest, middle - ((a - c) * (a - c)) / (8 * curved));
      }
      filled = true;
    }
  }
  return gainToDb(highest);
}

export interface Band {
  center: number; // Hz
  db: number; // band energy relative to a full-scale sine
  correlation: number; // L/R correlation inside the band
}

export interface Spectrum {
  bands: Band[];
  centroidHz: number;
  rolloffHz: number;
  totalDb: number;
}

export const BAND_CENTERS = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// Welch average of Hann frames. Band levels are the mean of the two channel powers, so they add
// up to the signal's mean square regardless of how wide the stereo image is.
export function analyzeSpectrum(left: Float32Array, right: Float32Array, rate: number): Spectrum {
  const size = 4096, window = hann(size);
  const hop = Math.max(size, Math.ceil(Math.max(left.length, 1) / 1500));
  const mid = new Float64Array(size), sideL = new Float64Array(size), sideR = new Float64Array(size), cross = new Float64Array(size);
  const re = new Float64Array(size), im = new Float64Array(size), reR = new Float64Array(size), imR = new Float64Array(size);
  let frames = 0;
  for (let start = 0; start + size <= left.length; start += hop) {
    for (let i = 0; i < size; i++) {
      re[i] = left[start + i] * window[i];
      reR[i] = right[start + i] * window[i];
      im[i] = 0;
      imR[i] = 0;
    }
    fft(re, im);
    fft(reR, imR);
    for (let k = 0; k < size; k++) {
      const l2 = re[k] * re[k] + im[k] * im[k], r2 = reR[k] * reR[k] + imR[k] * imR[k];
      cross[k] += re[k] * reR[k] + im[k] * imR[k];
      sideL[k] += l2;
      sideR[k] += r2;
      mid[k] += (l2 + r2) / 2;
    }
    frames++;
  }
  if (!frames) return { bands: [], centroidHz: 0, rolloffHz: 0, totalDb: -Infinity };
  const windowPower = frames * size * window.reduce((sum, value) => sum + value * value, 0);
  const binHz = rate / size;
  const level = (energy: number) => 10 * Math.log10(Math.max(1e-20, (2 * energy) / windowPower));
  const bands = BAND_CENTERS.map((center) => {
    let energy = 0, ll = 0, rr = 0, lr = 0;
    for (let k = 1; k < size / 2; k++) {
      const hz = k * binHz;
      if (hz >= center / Math.SQRT2 && hz < center * Math.SQRT2) {
        energy += mid[k];
        ll += sideL[k];
        rr += sideR[k];
        lr += cross[k];
      }
    }
    return { center, db: level(energy), correlation: lr / Math.sqrt(Math.max(1e-30, ll * rr)) };
  });
  let total = 0, weighted = 0;
  for (let k = 1; k < size / 2; k++) { total += mid[k]; weighted += k * binHz * mid[k]; }
  let rolloff = 0, accumulated = 0;
  for (let k = 1; k < size / 2 && total > 0; k++) {
    accumulated += mid[k];
    if (accumulated >= 0.95 * total) { rolloff = k * binHz; break; }
  }
  return { bands, centroidHz: total ? weighted / total : 0, rolloffHz: rolloff, totalDb: level(total) };
}

export interface Stereo {
  correlation: number; // Pearson correlation of L and R
  midSideDb: number; // 10 log10 of mid energy over side energy
  monoLossDb: number; // power lost when the mix is folded to mono
}

export function analyzeStereo(left: Float32Array, right: Float32Array): Stereo {
  let ll = 0, rr = 0, lr = 0, mid = 0, side = 0;
  for (let i = 0; i < left.length; i++) {
    const l = left[i], r = right[i];
    ll += l * l;
    rr += r * r;
    lr += l * r;
    mid += ((l + r) / 2) ** 2;
    side += ((l - r) / 2) ** 2;
  }
  return {
    correlation: lr / Math.sqrt(Math.max(1e-30, ll * rr)),
    midSideDb: 10 * Math.log10(mid / Math.max(1e-30, side)),
    monoLossDb: 10 * Math.log10(mid / Math.max(1e-30, (ll + rr) / 2)),
  };
}

// RMS level in dB of equal blocks. The caller groups the blocks into bars or sections.
export function energyCurve(left: Float32Array, right: Float32Array, blocks: number): Float32Array {
  const out = new Float32Array(blocks);
  const length = left.length;
  for (let b = 0; b < blocks; b++) {
    const from = Math.floor((b * length) / blocks), to = Math.max(from + 1, Math.floor(((b + 1) * length) / blocks));
    out[b] = (rmsDb(left, from, to) + rmsDb(right, from, to)) / 2;
  }
  return out;
}
