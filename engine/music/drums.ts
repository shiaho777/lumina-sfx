import { noise } from '../dsp.ts';
import { biquad, rng, sineOsc } from './dsp.ts';
import type { DrumSound } from './score.ts';

export type DrumVoice = DrumSound | 'timpani';

const drums = {
  kick: { frequency: 53, contact: 0.009, modes: [[1, 0.84, 0.114], [1.42, 0.20, 0.048], [1.62, 0.15, 0.035], [2.18, 0.10, 0.021], [2.64, 0.045, 0.014]] },
  'low-drum': { frequency: 47, contact: 0.013, modes: [[1, 0.79, 0.175], [1.38, 0.27, 0.083], [1.62, 0.15, 0.059], [2.15, 0.13, 0.041], [2.65, 0.06, 0.027]] },
  snare: { frequency: 176, contact: 0.006, modes: [[1, 0.58, 0.064], [1.18, 0.19, 0.039], [1.57, 0.20, 0.041], [2.11, 0.13, 0.027], [2.56, 0.08, 0.017]] },
  tom: { frequency: 96, contact: 0.008, modes: [[1, 0.70, 0.125], [1.39, 0.24, 0.071], [1.72, 0.23, 0.057], [2.26, 0.12, 0.037], [2.81, 0.055, 0.019]] },
  timpani: { frequency: 0, contact: 0.012, modes: [[1, 0.62, 0.32], [1.50, 0.21, 0.21], [2.02, 0.13, 0.14], [2.48, 0.072, 0.084], [2.96, 0.048, 0.05]] },
} as const;

export function isDrumVoice(voice: string): voice is DrumVoice {
  return Object.hasOwn(drums, voice) || voice === 'hat' || voice === 'crash';
}

export function drumVoice(voice: DrumVoice, rate: number, tuning: number, seed: number, strength: number): (time: number) => number {
  const random = rng(seed);
  const white = noise(random, 'white');
  if (voice === 'hat' || voice === 'crash') {
    const closed = voice === 'hat';
    const air = biquad('highpass', closed ? 4200 : 3000, 0.62, rate);
    const shape = biquad('lowpass', closed ? 8800 : 9800, 0.71, rate);
    const body = biquad('bandpass', closed ? 6450 : 3860, 1.3, rate);
    return time => {
      const strike = white();
      const wash = shape(air(strike)) * Math.exp(-time / (closed ? 0.047 : 0.30));
      const edge = body(strike) * Math.exp(-time / (closed ? 0.018 : 0.105));
      return (closed ? 0.40 : 0.46) * wash + 0.16 * edge;
    };
  }

  const sound = drums[voice];
  const pitch = voice === 'timpani' ? tuning : sound.frequency * (0.987 + 0.023 * random());
  const strikePoint = random();
  const stretch = 0.96 + 0.08 * random();
  const modes = sound.modes.filter(([ratio]) => ratio * pitch * 1.16 < rate * 0.46)
    .map(([ratio, amplitude, decay], i) => ({
      hz: pitch * ratio,
      oscillator: sineOsc(rate),
      amplitude: amplitude * (i === 0 ? 1 : (0.72 + 0.32 * strength) * (0.88 + 0.24 * strikePoint)),
      decay: decay * stretch,
    }));
  const beater = biquad('bandpass', voice === 'snare' ? 1750 : 760 + 820 * strength, 0.83, rate);
  const shell = biquad('bandpass', voice === 'snare' ? 392 : voice === 'tom' ? 220 : 132, 1.45, rate);
  const rattling = biquad('bandpass', 2040 + 950 * strength, 0.63, rate);
  const wireBody = biquad('lowpass', 4700 + 1700 * strength, 0.75, rate);
  const bodyColor = biquad('lowpass', voice === 'snare' ? 3800 : 2050 + 850 * strength, 0.71, rate);
  return time => {
    const excitation = white();
    const compression = voice === 'timpani' ? 0.014 * Math.exp(-time / 0.024) :
      (0.034 + 0.076 * strength) * Math.exp(-time / 0.024) - 0.012 * Math.min(1, time * 12);
    let head = 0;
    for (const mode of modes) {
      head += mode.amplitude * Math.exp(-time / mode.decay) *
        mode.oscillator(mode.hz * (1 + compression));
    }
    const impact = (0.12 + strength * 0.26) * beater(excitation) * Math.exp(-time / sound.contact);
    let wire = 0;
    if (voice === 'snare' && time > 0.002) {
      const elapsed = time - 0.002;
      const rise = 1 - Math.exp(-elapsed / 0.0036);
      const collisions = 0.62 + 0.38 * Math.min(1, 2.2 * Math.abs(head));
      wire = (0.43 + 0.21 * strength) * wireBody(rattling(excitation)) * rise *
        Math.exp(-elapsed / (0.036 + 0.023 * strength)) * collisions;
    }
    return 0.76 * bodyColor(head) + 0.16 * shell(head) + impact + wire;
  };
}
