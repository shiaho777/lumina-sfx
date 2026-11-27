import { responses } from './hrtf/sadie-h3.ts';

// Each ear retains its measured arrival time. Adjacent grid responses are
// blended before convolution; wrap azimuth and collapse each pole to one ear pair.
let samples: Int16Array | undefined;
function table() {
  if (!samples) {
    const binary = atob(responses);
    samples = new Int16Array(binary.length / 2);
    for (let i = 0; i < samples.length; i++)
      samples[i] = binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8);
  }
  return samples;
}
function index(row: number, column: number) {
  if (row === 0) return 0;
  if (row === 12) return 265;
  return 1 + (row - 1) * 24 + (column % 24);
}
export function headphoneFilter(
  azimuth: number,
  elevation: number,
  rate: number,
): [Float32Array, Float32Array] {
  const col = (((-azimuth % 360) + 360) % 360) / 15;
  const row = (Math.max(-90, Math.min(90, elevation)) + 90) / 15;
  const x = Math.floor(col),
    y = Math.floor(row),
    nx = col - x,
    ny = row - y;
  const positions = [
    index(y, x),
    index(y, x + 1),
    index(Math.min(12, y + 1), x),
    index(Math.min(12, y + 1), x + 1),
  ];
  const weights = [(1 - nx) * (1 - ny), nx * (1 - ny), (1 - nx) * ny, nx * ny];
  const data = table(),
    count = Math.ceil((256 * rate) / 44100);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  for (const [ear, kernel] of [left, right].entries()) {
    const native = new Float32Array(256);
    for (let corner = 0; corner < 4; corner++) {
      const offset = 512 * positions[corner] + ear * 256,
        gain = weights[corner] / 32768;
      for (let i = 0; i < 256; i++) native[i] += gain * data[offset + i];
    }
    // Windowed-sinc resampling retains filter DC gain when the device rate changes.
    if (rate === 44100) {
      kernel.set(native);
      continue;
    }
    const step = 44100 / rate,
      band = Math.min(1, 1 / step);
    for (let i = 0; i < count; i++) {
      const pos = i * step,
        reach = 8 / band;
      for (let j = Math.max(0, Math.ceil(pos - reach)); j <= Math.min(255, pos + reach); j++) {
        const z = (pos - j) * band,
          s = Math.PI * z;
        const sinc = Math.abs(s) < 1e-8 ? 1 : Math.sin(s) / s;
        kernel[i] += native[j] * step * band * sinc * (0.5 + 0.5 * Math.cos((Math.PI * z) / 8));
      }
    }
  }
  return [left, right];
}
