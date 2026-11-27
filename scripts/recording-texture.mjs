import { rng } from '../engine/dsp.ts';

export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let width = 2; width <= n; width *= 2) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / width;
    const cr = Math.cos(angle),
      ci = Math.sin(angle);
    for (let left = 0; left < n; left += width) {
      let wr = 1,
        wi = 0;
      for (let k = 0; k < width / 2; k++) {
        const a = left + k,
          b = a + width / 2;
        const x = re[b] * wr - im[b] * wi,
          y = re[b] * wi + im[b] * wr;
        re[b] = re[a] - x;
        im[b] = im[a] - y;
        re[a] += x;
        im[a] += y;
        const next = wr * cr - wi * ci;
        wi = wr * ci + wi * cr;
        wr = next;
      }
    }
  }
}
export function stationaryTexture(take, sampleRate, length = 65536) {
  const input = Buffer.from(take, 'base64'),
    n = 4096,
    bins = n / 2;
  const frames = Array.from({ length: bins + 1 }, () => []);
  for (let offset = 0; offset + n <= input.length / 2; offset += bins) {
    const re = Float64Array.from(
      { length: n },
      (_, i) => (input.readInt16LE(2 * (offset + i)) / 32768) * (0.5 - 0.5 * Math.cos((i * 2 * Math.PI) / n)),
    );
    const im = new Float64Array(n);
    fft(re, im);
    for (let i = 0; i <= bins; i++) frames[i].push(Math.hypot(re[i], im[i]));
  }
  if (!frames[0].length) throw Error('Engine reference too short');
  const median = frames.map((frame) => frame.sort((a, b) => a - b)[frame.length >> 1]);
  const re = new Float64Array(length),
    im = new Float64Array(length);
  const random = rng(51839);
  for (let k = 1; k < length / 2; k++) {
    const bin = (k * n) / length,
      index = Math.floor(bin);
    const magnitude = median[index] + (bin - index) * (median[index + 1] - median[index]);
    const phase = 2 * Math.PI * random();
    const gain = magnitude * Math.sqrt(-Math.log(Math.max(0.00001, random())));
    re[k] = re[length - k] = gain * Math.cos(phase);
    im[k] = gain * Math.sin(phase);
    im[length - k] = -im[k];
  }
  // A random-phase noise bed alone smears shaft harmonics into hiss. Return some
  // energy from narrow, persistent spectral peaks to coherent rotating components.
  const peaks = [];
  for (let i = 4; i < bins - 4; i++) {
    const floor = (median[i - 3] + median[i + 3] + median[i - 4] + median[i + 4]) / 4;
    if (
      (i * sampleRate) / n < 30 ||
      median[i] <= 2.8 * floor ||
      median[i] < median[i - 1] ||
      median[i] <= median[i + 1]
    )
      continue;
    const offset = Math.max(
      -0.5,
      Math.min(0.5, (0.5 * (median[i - 1] - median[i + 1])) / (median[i - 1] - 2 * median[i] + median[i + 1])),
    );
    peaks.push({ bin: i + offset, strength: median[i] - floor });
  }
  for (const peak of peaks.sort((a, b) => b.strength - a.strength).slice(0, 8)) {
    const center = Math.round((peak.bin * length) / n);
    const radius = Math.round(length / n);
    let movedPower = 0;
    for (let k = center - radius; k <= center + radius; k++) {
      const fraction = 0.72 * (1 - Math.abs(k - center) / (radius + 1));
      movedPower += fraction * (re[k] ** 2 + im[k] ** 2);
      const retain = Math.sqrt(1 - fraction);
      re[k] = re[length - k] = re[k] * retain;
      im[k] *= retain;
      im[length - k] = -im[k];
    }
    const amplitude = Math.sqrt(re[center] ** 2 + im[center] ** 2 + movedPower);
    const phase = Math.atan2(im[center], re[center]);
    re[center] = re[length - center] = amplitude * Math.cos(phase);
    im[center] = amplitude * Math.sin(phase);
    im[length - center] = -im[center];
  }
  fft(re, im, true);
  const peak = re.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
  if (!(peak > 0)) throw Error('Silent engine reference');
  const pcm = Buffer.alloc(length * 2);
  for (let i = 0; i < length; i++) pcm.writeInt16LE(Math.round((re[i] / peak) * 28500), i * 2);
  return pcm.toString('base64');
}
