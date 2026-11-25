// Measurements that stand in for ears: every number the music report prints is verified here first.
import assert from 'node:assert/strict';
import {
  TAU, adsrCurve, compress, fft, hann, limit, makeSVF, pulseOsc,
  responseDb, sawOsc, sineOsc, triangleOsc,
} from '../engine/music/dsp.ts';
import {
  analyzeSpectrum, analyzeStereo, kWeighting, kWeightingCoefficients, measureLoudness, samplePeakDb, truePeakDb,
} from '../engine/music/meter.ts';
import { rng } from '../engine/dsp.ts';

const RATE = 48000;
const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected} (±${tolerance})`);

// K-weighting reproduces the published BS.1770 coefficients for a 48 kHz meter.
const [shelf, high] = kWeightingCoefficients(RATE);
const publishedShelf = [1.53512485958697, -2.69169618940638, 1.19839281085285, 1, -1.69065929318241, 0.73248077421585];
shelf.forEach((value, i) => near(value, publishedShelf[i], 1e-9, 'K-weighting shelf ' + i));
[-1.99004745483398, 0.99007225036621].forEach((value, i) => near(high[4 + i] / high[3], value, 1e-9, 'K-weighting high-pass ' + i));
near(high[0] + high[1] + high[2], 0, 1e-12, 'High-pass rejects DC');
near((high[0] - high[1] + high[2]) / (high[3] - high[4] + high[5]), 1, 1e-9, 'High-pass passes the band above');
assert.ok(kWeighting(44100).every((stage) => Number.isFinite(stage(1))), 'K-weighting designs at 44.1 kHz');
console.log('Passed K-weighting coefficients against the BS.1770 reference.');

// Loudness of steady tones follows the −0.69 LUFS offset and the measured K-weighting curve.
// At 997 Hz K-weighting is +0.65 dB, so a full-scale mono sine reads −3.05 LUFS, and at 4 kHz it is +3.92 dB.
const seconds = 6;
const tone = (hz, amplitude, phase = 0, rate = RATE) =>
  Float32Array.from({ length: seconds * rate }, (_, i) => amplitude * Math.sin((TAU * hz * i) / rate + phase));
const mono = measureLoudness([tone(997, 1)], RATE);
near(mono.integrated, -3.05, 0.05, 'Mono full-scale 997 Hz sine');
const stereo = measureLoudness([tone(997, 1), tone(997, 1)], RATE);
near(stereo.integrated, mono.integrated + 3.01, 0.05, 'Stereo adds 3 dB');
const quiet = measureLoudness([tone(997, 0.1), tone(997, 0.1)], RATE);
near(quiet.integrated, stereo.integrated - 20, 0.05, 'Linearity in dB');
const oneSide = measureLoudness([tone(997, 0.1), new Float32Array(seconds * RATE)], RATE);
near(oneSide.integrated, quiet.integrated - 3.01, 0.05, 'A single channel reads 3 dB lower');
const present = measureLoudness([tone(4000, 0.1), tone(4000, 0.1)], RATE);
near(present.integrated, quiet.integrated + 3.27, 0.1, 'The presence shelf lifts 4 kHz by 3.27 dB over 997 Hz');
const rumble = measureLoudness([tone(20, 1), tone(20, 1)], RATE);
near(rumble.integrated, stereo.integrated - 13.97, 0.15, 'The 38 Hz high-pass de-emphasises 20 Hz');
const resampled = measureLoudness([tone(997, 1, 0, 44100), tone(997, 1, 0, 44100)], 44100);
near(resampled.integrated, stereo.integrated, 0.05, 'The design holds at 44.1 kHz');
const shortTransient = Float32Array.from({ length: 256 }, (_, i) => Math.sin(i * 0.07) * i / 256);
const emptyChannel = new Float32Array(shortTransient.length);
near(measureLoudness([shortTransient, emptyChannel], RATE).integrated,
  measureLoudness([emptyChannel, shortTransient], RATE).integrated, 1e-9, 'Filter state stays local to each channel');
console.log('Passed loudness linearity, channel summing and K-weighting tilt.');

// Quiet tails and pauses do not pull the integrated reading down.
const steady = measureLoudness([tone(440, 0.5), tone(440, 0.5)], RATE).integrated;
const gated = Float32Array.from({ length: seconds * RATE }, (_, i) =>
  0.5 * Math.sin((TAU * 440 * i) / RATE) * (i < 2 * RATE ? 1 : i < 3 * RATE ? 0.003 : 1));
near(measureLoudness([gated, gated], RATE).integrated, steady, 0.4, 'Gating');
// A −16 dB passage stays inside the 20 LU relative gate of EBU Tech 3342 and widens the range.
const dynamic = Float32Array.from({ length: 12 * RATE }, (_, i) =>
  0.5 * Math.sin((TAU * 440 * i) / RATE) * (i >= 4 * RATE && i < 8 * RATE ? 0.16 : 1));
const dynamicLoudness = measureLoudness([dynamic, dynamic], RATE);
assert.ok(dynamicLoudness.lra > 8, 'A quiet passage widens the loudness range: ' + dynamicLoudness.lra);
assert.ok(dynamicLoudness.lra < 17, 'The range stops at the quiet passage level: ' + dynamicLoudness.lra);
assert.ok(measureLoudness([tone(440, 0.5), tone(440, 0.5)], RATE).lra < 1, 'A steady tone has no loudness range');
console.log('Passed absolute and relative gating and loudness range.');

// True peak is verified against exact band-limited interpolation: the signal is zero-padded to a
// power of two, its spectrum is surrounded by zeros and transformed back at 32 times the rate.
const referenceTruePeak = (signal, ratio = 32) => {
  const length = 2 ** Math.ceil(Math.log2(2 * signal.length)), size = ratio * length;
  const re = new Float64Array(length), im = new Float64Array(length);
  re.set(signal);
  fft(re, im);
  const wide = new Float64Array(size), wideIm = new Float64Array(size);
  for (let k = 0; k < length / 2; k++) {
    wide[k] = re[k]; wideIm[k] = im[k];
    wide[size - k] = re[length - k]; wideIm[size - k] = im[length - k];
  }
  fft(wide, wideIm, true);
  let peak = 0;
  for (let i = 0; i < size; i++) peak = Math.max(peak, (ratio * Math.abs(wide[i])) / size);
  return 20 * Math.log10(peak);
};
// Raised-cosine fades on both ends keep an abrupt start from ringing in the exact reference.
const fade = (signal, edge = 512) => {
  const out = signal.slice();
  for (let i = 0; i < edge && i < out.length; i++) {
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * i) / edge);
    out[i] *= gain;
    out[out.length - 1 - i] *= gain;
  }
  return out;
};
// The estimator may under-read on broadband noise, where the exact interpolation rings right up to
// Nyquist, but it never reports a peak that is not there.
const agree = (label, signal, under = 0.06, over = 0.06) => {
  const estimate = truePeakDb([signal]), exact = referenceTruePeak(signal);
  assert.ok(estimate <= exact + over, label + ': reads ' + estimate + ' dBTP above the exact ' + exact);
  assert.ok(estimate >= exact - under, label + ': reads ' + estimate + ' dBTP below the exact ' + exact);
};
// The estimator's 4x grid sits an eighth of a sample off the sample instants, so a sine peaking
// half a sample off them falls halfway between grid points and needs the parabolic refinement.
const interSampleSine = (period, fadeInEnd, fadeOutStart, length) =>
  Float32Array.from({ length }, (_, i) => {
    const fadeIn = Math.min(1, i / fadeInEnd), fadeOut = i > fadeOutStart ? Math.max(0, 1 - (i - fadeOutStart) / (length - fadeOutStart)) : 1;
    return Math.cos((TAU * (i - 0.5)) / period) * (0.5 - 0.5 * Math.cos(Math.PI * fadeIn)) * (0.5 + 0.5 * Math.cos(Math.PI * (1 - fadeOut)));
  });
for (const [period, fadeInEnd, fadeOutStart, length] of [[3.75, 11.25, 17.9, 29], [4.25, 12.875, 20.125, 31], [6.75, 20, 34, 50], [12.3, 30, 60, 90], [31.7, 90, 180, 250]]) {
  const between = interSampleSine(period, fadeInEnd, fadeOutStart, length);
  assert.ok(referenceTruePeak(between) > -0.02, 'The exact interpolation reaches full scale for period ' + period);
  agree('True peak for a ' + period + ' sample period', between, 0.06, 0.04);
}
agree('True peak of an aligned sine', fade(tone(1000, 1).subarray(0, 48000)), 0.03, 0.03);
// The estimate holds across the band up to 0.8 of Nyquist for arbitrary phases.
for (const fraction of [0.0625, 0.2, 0.37, 0.62, 0.79]) {
  agree('True peak at ' + fraction + ' of Nyquist', fade(tone(fraction * RATE / 2, 1, 0.9, RATE).subarray(0, 48000)), 0.06, 0.06);
}
// Chords, transients and noise are where inter-sample peaks matter in a real mix.
const shape = rng(11);
const dense = fade(Float32Array.from({ length: 24000 }, (_, i) => {
  const t = i / RATE;
  return 0.5 * Math.sin(TAU * 131.85 * t) + 0.3 * Math.sin(TAU * 523.3 * t + 1) + 0.2 * Math.sin(TAU * 3136 * t + 2) + 0.1 * (shape() * 2 - 1);
}));
agree('True peak of a dense mix', dense, 0.08, 0.06);
// White noise is the worst case: its exact interpolation rings right up to Nyquist, beyond the
// passband of any practical meter. The estimate stays within 1.5 dB and this is why a −1 dBTP
// ceiling is the recommended delivery target.
agree('True peak of white noise', fade(Float32Array.from({ length: 24000 }, () => shape() * 2 - 1)), 1.5, 0.06);
// A drum-like transient carries a noise burst, so it inherits part of the noise under-read.
agree('True peak of a transient', fade(Float32Array.from({ length: 24000 }, (_, i) =>
  i < 400 ? 0 : Math.exp(-(i - 400) / 300) * Math.sin(TAU * 0.21 * (i - 400)) + 0.5 * Math.exp(-(i - 400) / 30) * (shape() * 2 - 1))), 0.4, 0.06);
const sparse = new Float32Array(RATE);
sparse[12345] = 1;
agree('An isolated sample', sparse, 0.03, 0.03);
sparse.fill(0);
sparse[7] = 1;
agree('An isolated sample near the start', sparse, 0.03, 0.03);
assert.ok(truePeakDb([new Float32Array(10)]) < -150, 'Silence');
console.log('Passed true-peak estimation against exact band-limited interpolation.');

// Spectrum levels add up to the signal's mean square and band correlation reports phase.
const sine = tone(1000, 1);
const spectrum = analyzeSpectrum(sine, sine, RATE);
near(spectrum.totalDb, -3.01, 0.05, 'Total energy of a full-scale sine');
near(spectrum.bands.find((band) => band.center === 1000).db, -3.01, 0.05, 'Energy lands in its own band');
assert.ok(spectrum.bands.every((band) => band.center === 1000 || band.db < -60), 'A pure tone leaves other bands empty');
near(spectrum.centroidHz, 1000, 5, 'Spectral centroid');
const random = rng(7);
const left = Float32Array.from({ length: sine.length }, () => random() * 2 - 1);
const right = Float32Array.from({ length: sine.length }, () => random() * 2 - 1);
const noise = analyzeSpectrum(left, right, RATE);
assert.ok(noise.bands.length === 10, 'Ten octave bands');
noise.bands.slice(1, 8).forEach((band, i, all) => assert.ok(Math.abs(band.db - all[Math.max(0, i - 1)].db) < 4.5, 'White noise rises about 3 dB per octave: ' + JSON.stringify(noise.bands.map((b) => b.db))));
near(noise.totalDb, -4.77, 0.3, 'Total energy of unit white noise');
assert.ok(noise.bands.every((band) => Math.abs(band.correlation) < 0.25), 'Independent channels are uncorrelated');
const stereoTone = analyzeStereo(sine, sine);
near(stereoTone.correlation, 1, 1e-6, 'Identical channels correlate');
near(stereoTone.monoLossDb, 0, 1e-6, 'Mono fold of identical channels loses nothing');
const opposite = analyzeStereo(sine, sine.map((x) => -x));
near(opposite.correlation, -1, 1e-6, 'Opposite channels anti-correlate');
near(analyzeStereo(left, right).monoLossDb, -3.01, 0.05, 'Mono fold of uncorrelated channels loses 3 dB');
console.log('Passed spectrum calibration and stereo correlation.');

// A look-ahead limiter keeps every sample under the ceiling and reports its gain reduction.
const hot = Float32Array.from({ length: 3 * RATE }, (_, i) => 2.5 * Math.sin((TAU * 220 * i) / RATE) * (i > RATE / 2 ? 1 : 0.2));
const hotRight = hot.slice();
const ceiling = 10 ** (-1 / 20);
const limited = limit(hot, hotRight, { rate: RATE, ceiling, lookaheadMs: 5, releaseMs: 120 });
let peak = 0;
for (const value of hot) peak = Math.max(peak, Math.abs(value));
assert.ok(peak <= ceiling * 1.0001, 'Limiter ceiling respected: ' + peak);
assert.ok(limited.reductionDb > 7 && limited.reductionDb < 9.5, 'Gain reduction matches the overshoot: ' + limited.reductionDb);
let quietest = Infinity;
const cue = RATE / 2, lookahead = Math.round(RATE * 0.005);
for (let i = 0; i < cue - lookahead; i++) quietest = Math.min(quietest, limited.gain[i]);
near(quietest, 1, 0.001, 'The quiet intro outside the lookahead retains unity gain');
assert.ok(limited.gain[cue - 1] < 0.5, 'The limiter anticipates the loud onset');
near(limited.reductionDb, -20 * Math.log10(limited.gain.reduce((minimum, value) => Math.min(minimum, value), 1)), 1e-6, 'Reported peak reduction follows applied gain');
const loopLeft = Float32Array.from({ length: RATE }, (_, i) => Math.sin((TAU * 300 * i) / RATE) + 0.8 * Math.sin((TAU * 17 * i) / RATE));
const loopLimited = limit(loopLeft, loopLeft.slice(), { rate: RATE, ceiling, loop: true });
near(loopLimited.gain[0], loopLimited.gain[loopLeft.length - 1], 2e-4, 'The loop gain envelope is continuous across the seam');
assert.ok(loopLimited.gain.every((g) => g <= 1), 'Gain never exceeds unity');
console.log('Passed limiter ceiling, reduction reporting and cyclic gain.');

const compressed = new Float32Array(44100 * 2).fill(10 ** (-6 / 20));
const reduction = compress(compressed, compressed.slice(), 44100, { thresholdDb: -20, ratio: 4, attackMs: 5, releaseMs: 80, kneeDb: 0, makeupDb: 0 });
let compressedPeak = 0;
for (let i = 44100; i < compressed.length; i++) compressedPeak = Math.max(compressedPeak, Math.abs(compressed[i]));
near(20 * Math.log10(compressedPeak), -16.5, 0.01, 'Compressor output at a steady detector input');
near(reduction, 10.5, 0.01, 'Compressor gain reduction');
console.log('Passed compressor transfer curve.');

// Oscillators are bounded, band-limited and in tune.
const spectrumOf = (signal, rate) => {
  const window = hann(signal.length);
  return (hz) => {
    let re = 0, im = 0;
    for (let i = 0; i < signal.length; i++) {
      const phase = TAU * hz * i / rate;
      const sample = signal[i] * window[i];
      re += sample * Math.cos(phase);
      im += sample * Math.sin(phase);
    }
    return 4 * Math.hypot(re, im) / signal.length;
  };
};
for (const hz of [55, 220, 440, 1760]) {
  const saw = sawOsc(RATE), signal = Float32Array.from({ length: 1 << 16 }, () => saw(hz));
  assert.ok([...signal].every((x) => Math.abs(x) <= 1.0001), 'Saw stays within ±1');
  const amplitude = spectrumOf(signal, RATE);
  near(amplitude(hz), 2 / Math.PI, 0.01, 'Saw fundamental');
  near(amplitude(2 * hz), 1 / Math.PI, 0.015, 'Saw second harmonic');
  near(amplitude(5 * hz), 2 / (5 * Math.PI), 0.02, 'Saw fifth harmonic');
  if (10 * hz < RATE / 4) near(amplitude(10 * hz), 2 / (10 * Math.PI), 0.01, 'Saw tenth harmonic');
}
for (const duty of [0.125, 0.25, 0.5]) {
  const pulse = pulseOsc(RATE), signal = Float32Array.from({ length: 1 << 16 }, () => pulse(330, duty));
  assert.ok([...signal].every((x) => Math.abs(x) <= 1.0001), 'Pulse stays within ±1');
  const amplitude = spectrumOf(signal, RATE);
  near(amplitude(330), 4 * Math.sin(Math.PI * duty) / Math.PI, 0.05, 'Pulse fundamental');
}
const square = pulseOsc(RATE), squareSignal = Float32Array.from({ length: 1 << 16 }, () => square(330, 0.5));
const squareAmplitude = spectrumOf(squareSignal, RATE);
assert.ok(squareAmplitude(660) < 0.02 && squareAmplitude(990) > 0.35, 'A square has odd harmonics only');
const triangle = triangleOsc(RATE), triangleSignal = Float32Array.from({ length: 1 << 16 }, () => triangle(220));
assert.ok(Math.max(...triangleSignal) < 1.05 && Math.min(...triangleSignal) > -1.05, 'Triangle stays near ±1');
const triangleAmplitude = spectrumOf(triangleSignal, RATE);
assert.ok(triangleAmplitude(660) < 0.2 * triangleAmplitude(220) && triangleAmplitude(1100) < 0.08 * triangleAmplitude(220), 'Triangle harmonics fall as 1/n²');
const sineSource = sineOsc(RATE);
let reference = 0;
for (let i = 0; i < 48000; i++) reference = Math.max(reference, Math.abs(sineSource(1000) - Math.sin((TAU * 1000 * i) / RATE)));
assert.ok(reference < 1e-4, 'Sine is in phase with the reference');
console.log('Passed band-limited saw, pulse, square, triangle and sine responses.');

// The state-variable filter rolls off at 12 dB per octave with a stable resonant peak.
for (const q of [0.707, 4, 20]) {
  const filtered = (hz) => {
    const svf = makeSVF(RATE);
    let sum = 0, count = 0;
    for (let i = 0; i < 24000; i++) { const y = svf(Math.sin((TAU * hz * i) / RATE), 1000, q).low; if (i > 4000) { sum += y * y; count++; } }
    return 20 * Math.log10(Math.sqrt(sum / count) * Math.SQRT2);
  };
  for (const hz of [100, 1000, 8000]) {
    const warped = Math.tan(Math.PI * hz / RATE) / Math.tan(Math.PI * 1000 / RATE);
    const expected = -10 * Math.log10((1 - warped ** 2) ** 2 + (warped / q) ** 2);
    near(filtered(hz), expected, 0.03, 'SVF response at ' + hz + ' Hz');
  }
}
const tracking = makeSVF(RATE);
assert.ok(Number.isFinite(tracking(1, 10, 20).low) && Number.isFinite(tracking(1, 20000, 20).low), 'SVF survives extreme cutoffs');
const shelfFilter = responseDb((x) => x, 1000, RATE);
near(shelfFilter, 0, 1e-9, 'Identity response');
console.log('Passed SVF passband, slope, resonance and stability.');

// Envelopes reach unity, hold the sustain and release to silence.
const envelope = adsrCurve(44100, 44100, 22050, 0.01, 0.1, 0.6, 0.2);
near(Math.max(...envelope), 1, 1e-6, 'Envelope peak');
near(envelope[15000], 0.6, 0.01, 'Envelope sustain');
assert.ok(envelope[44099] === 0, 'Envelope ends silent');
assert.ok(envelope.every((value) => value >= 0 && value <= 1), 'Envelope stays in [0, 1]');
const short = adsrCurve(44100, 44100, 44, 0.01, 0.1, 0.6, 0.2);
near(short[44], short[43], 1e-6, 'Release begins at the level reached during attack');
assert.ok(Math.max(...short) < 0.1 && short.every((value) => value >= 0), 'The short note releases before completing the attack');
const chirp = Float32Array.from({ length: 4096 }, (_, i) => Math.sin((TAU * 100 * i) / 4096));
const real = Float64Array.from(chirp), imaginary = new Float64Array(4096);
fft(real, imaginary);
fft(real, imaginary, true);
assert.ok(chirp.every((value, i) => Math.abs((real[i] / 4096) - value) < 1e-9), 'FFT round trip');
console.log('Passed envelope shape, short-note release and FFT round trip.');
void kWeighting;
