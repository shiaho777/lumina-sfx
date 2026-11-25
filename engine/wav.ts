import { SAMPLE_RATE } from './render.ts';
import { rng } from './dsp.ts';

export interface WavOptions {
  bits?: 16 | 24;
  ditherSeed?: number;
}

export function encodeWav(input: Float32Array | readonly Float32Array[], sampleRate = SAMPLE_RATE, options: WavOptions = {}): ArrayBuffer {
  const channels = input instanceof Float32Array ? [input] : input;
  if (![1, 2].includes(channels.length) || channels.some(c => c.length !== channels[0].length)) {
    throw new Error('Expected one or two equal-length PCM channels');
  }
  const frames = channels[0].length;
  const bits = options.bits ?? 16;
  if (bits !== 16 && bits !== 24) throw new RangeError('WAV depth must be 16 or 24 bits');
  const width = bits / 8;
  const stride = channels.length * width;
  const dataSize = frames * stride;
  const wav = new ArrayBuffer(44 + dataSize + (dataSize % 2));
  const view = new DataView(wav);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, wav.byteLength - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * stride, true);
  view.setUint16(32, stride, true);
  view.setUint16(34, bits, true);
  ascii(36, 'data');
  view.setUint32(40, dataSize, true);
  const scale = 2 ** (bits - 1);
  const random = options.ditherSeed === undefined ? undefined : rng(options.ditherSeed);
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels.length; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const offset = 44 + i * stride + width * ch;
      const noise = random && sample !== 0 ? random() - random() : 0;
      const quantized = Math.max(-scale, Math.min(scale - 1, Math.round(sample * (sample < 0 ? scale : scale - 1) + noise)));
      if (bits === 16) view.setInt16(offset, quantized, true);
      else {
        view.setUint16(offset, quantized & 0xffff, true);
        view.setUint8(offset + 2, (quantized >> 16) & 0xff);
      }
    }
  }
  return wav;
}
