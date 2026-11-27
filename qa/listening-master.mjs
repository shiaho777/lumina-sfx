import { renderChannels, SAMPLE_RATE } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { renderDurationSec } from '../engine/sculpt.ts';
import { spectrum } from './metrics.mjs';

// A scene carries intentional distance loss, stereo arrival differences and silent cues.
// Check the delivered PCM on its own clock; its authored level is preserved.
export function checkListeningMaster(recipe, options, repeat) {
  const channels = renderChannels(recipe, options);
  const master = encodeWav(channels);
  const view = new DataView(master),
    n = channels.length,
    frames = channels[0].length;
  let peak = 0,
    energy = 0,
    monoEnergy = 0,
    phoneEnergy = 0,
    low = 0,
    high = 0,
    onsetFrame = null;
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let ch = 0; ch < n; ch++) {
      const v = view.getInt16(44 + 2 * (i * n + ch), true) / 32768;
      peak = Math.max(peak, Math.abs(v));
      sum += v / n;
      energy += (v * v) / n;
      if (onsetFrame === null && Math.abs(v) > 1 / 32768) onsetFrame = i;
    }
    mono[i] = sum;
    monoEnergy += sum * sum;
    low += (1 - Math.exp((-2 * Math.PI * 280) / SAMPLE_RATE)) * (sum - low);
    high += (1 - Math.exp((-2 * Math.PI * 3800) / SAMPLE_RATE)) * (sum - low - high);
    phoneEnergy += high * high;
  }
  const ratio = monoEnergy / Math.max(1e-16, energy);
  const checks = {
    clock: { pass: frames === Math.round(renderDurationSec(recipe) * SAMPLE_RATE), frames, onsetFrame },
    pcm: {
      pass:
        view.getUint16(22, true) === n &&
        view.getUint32(24, true) === SAMPLE_RATE &&
        master.byteLength === 44 + frames * n * 2 &&
        peak > 1 / 32768 &&
        peak <= 10 ** (-0.5 / 20),
      peak,
    },
    fold: {
      pass: ratio > 0.025,
      monoEnergyRatio: ratio,
      phoneBandShare: phoneEnergy / Math.max(monoEnergy, 1e-16),
    },
  };
  if (recipe.spectrum?.length) {
    const bands = spectrum(mono, SAMPLE_RATE);
    checks.spectrum = { pass: recipe.spectrum.every((t) => bands[t.band] >= t.minShare), bands };
  }
  if (repeat)
    checks.repeat = {
      pass: Buffer.from(master).equals(
        Buffer.from(encodeWav(renderChannels(recipe, { ...options, level: 'balanced' }))),
      ),
    };
  return { master, checks };
}
