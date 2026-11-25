import { noise } from '../dsp.ts';
import { biquad, clamp, rng, sineOsc, TAU } from './dsp.ts';
import type { DrumSound } from './score.ts';

export type DrumVoice = DrumSound | 'timpani';

const drums = {
  kick: {
    frequency: 54, contact: 0.0065, beater: 1050, shell: 157, decay: 0.102, pair: [1.83, 0.32, 0.055],
    modes: [[1.37, 0.15, 0.040], [2.16, 0.10, 0.031], [2.71, 0.072, 0.018], [4.25, 0.042, 0.014], [7.58, 0.035, 0.008]],
  },
  'low-drum': {
    frequency: 45, contact: 0.0087, beater: 690, shell: 125, decay: 0.164, pair: [2.16, 0.39, 0.092],
    modes: [[1.59, 0.17, 0.069], [2.59, 0.12, 0.048], [3.85, 0.075, 0.030], [5.08, 0.052, 0.020], [8.32, 0.045, 0.014]],
  },
  snare: {
    frequency: 177, contact: 0.0023, beater: 1900, shell: 416, decay: 0.060, pair: [1.66, 0.32, 0.042],
    modes: [[1.24, 0.18, 0.040], [1.91, 0.13, 0.029], [2.42, 0.12, 0.024], [3.25, 0.075, 0.013], [5.46, 0.055, 0.008]],
  },
  tom: {
    frequency: 96, contact: 0.0038, beater: 1420, shell: 211, decay: 0.127, pair: [1.86, 0.28, 0.090],
    modes: [[1.33, 0.18, 0.074], [1.73, 0.12, 0.056], [2.33, 0.09, 0.037], [3.49, 0.07, 0.022], [5.06, 0.065, 0.013]],
  },
  timpani: {
    frequency: 0, contact: 0.0055, beater: 1070, shell: 240, decay: 0.33, pair: undefined,
    modes: [[0.79, 0.07, 0.075], [1.5, 0.23, 0.22], [2.02, 0.14, 0.15], [2.49, 0.077, 0.100], [2.99, 0.051, 0.063]],
  },
} as const;

export function isDrumVoice(voice: string): voice is DrumVoice {
  return Object.hasOwn(drums, voice) || voice === 'hat' || voice === 'crash';
}

function classicTom(rate: number, seed: number, strength: number): (time: number) => number {
  const random = rng(seed);
  const white = noise(random, 'white');
  const pitch = 96 * (0.987 + 0.023 * random());
  const strikePoint = random();
  const stretch = 0.96 + 0.08 * random();
  const modes = [[1, 0.70, 0.125], [1.39, 0.24, 0.071], [1.72, 0.23, 0.057], [2.26, 0.12, 0.037], [2.81, 0.055, 0.019]]
    .filter(([ratio]) => ratio * pitch * 1.16 < rate * 0.46)
    .map(([ratio, amplitude, decay], i) => ({
      hz: pitch * ratio,
      oscillator: sineOsc(rate),
      amplitude: amplitude * (i === 0 ? 1 : (0.72 + 0.32 * strength) * (0.88 + 0.24 * strikePoint)),
      decay: decay * stretch,
    }));
  const beater = biquad('bandpass', 760 + 820 * strength, 0.83, rate);
  const shell = biquad('bandpass', 220, 1.45, rate);
  const body = biquad('lowpass', 2050 + 850 * strength, 0.71, rate);
  return time => {
    const excitation = white();
    const compression = (0.034 + 0.076 * strength) * Math.exp(-time / 0.024) - 0.012 * Math.min(1, time * 12);
    let head = 0;
    for (const mode of modes) {
      head += mode.amplitude * Math.exp(-time / mode.decay) * mode.oscillator(mode.hz * (1 + compression));
    }
    const impact = (0.12 + strength * 0.26) * beater(excitation) * Math.exp(-time / 0.008);
    return 0.76 * body(head) + 0.16 * shell(head) + impact;
  };
}

function drivenMode(rate: number, hz: number, amplitude: number, decay: number) {
  const loss = Math.exp(-1 / (rate * decay));
  const cosine = Math.cos(TAU * hz / rate) * loss, sine = Math.sin(TAU * hz / rate) * loss;
  let displacement = 0, velocity = 0;
  return (force: number) => {
    const next = velocity * cosine - displacement * sine + force * amplitude;
    displacement = displacement * cosine + velocity * sine;
    velocity = next;
    return displacement;
  };
}

function cymbal(rate: number, white: () => number, random: () => number, strength: number, closed: boolean) {
  const frequencies = [1460, 2130, 2890, 3520, 4155, 4630, 5478, 5794, 6213, 6806, 7291, 7932, 8430, 9677, 10809, 11726, 13064, 14358];
  const modes = frequencies.map((frequency, index) => ({
    hz: frequency * (closed ? 1.12 : 1) * (0.98 + 0.039 * random()),
    amplitude: (0.008 + 0.013 * Math.min(index / 8, 1)) * (0.77 + 0.46 * random()),
    decay: (closed ? 0.086 : 0.59) * (0.76 + 0.46 * random()) / (1 + frequency / 10300),
  })).filter(mode => mode.hz < rate * 0.44)
    .map(({ hz, amplitude, decay }) => drivenMode(rate, hz, amplitude, decay));
  const edge = biquad('bandpass', closed ? 7750 : 6250, 0.89, rate);
  const radiate = biquad('highpass', closed ? 4890 : 4970, 0.75, rate);
  const air = biquad('lowpass', closed ? 13300 : 14300, 0.67, rate);
  const collision = Math.round(rate * (0.0022 + 0.0048 * random()));
  const later = collision + Math.round(rate * (0.0011 + 0.002 * random()));
  const wash = closed ? 0.051 : 0.37 + 0.15 * strength;
  let frame = 0;
  return (time: number) => {
    const excitation = white();
    const strike = frame === 0 ? 1 : closed && frame === collision ? -0.65 : closed && frame === later ? 0.27 : 0;
    const bloom = 1 - Math.exp(-time / (closed ? 0.004 : 0.025));
    const flutter = (0.042 + 0.021 * strength) * bloom * Math.exp(-time / wash);
    const force = strike + flutter * excitation;
    let metal = 0;
    for (const mode of modes) metal += mode(force);
    const tap = (0.15 + strength * 0.25) * Math.exp(-time / (closed ? 0.016 : 0.030));
    const shimmer = (0.25 + strength * 0.37) * bloom * Math.exp(-time / wash);
    frame++;
    return air((closed ? 0.91 : 0.72) * metal + tap * edge(excitation) + shimmer * radiate(excitation));
  };
}

function snareWires(rate: number, strength: number, white: () => number) {
  const low = biquad('bandpass', 1540, 0.75, rate);
  const high = biquad('bandpass', 3070 + strength * 960, 0.83, rate);
  const radiation = biquad('lowpass', 4430 + strength * 820, 0.71, rate);
  const settling = Math.exp(-1 / (rate * (0.011 + 0.013 * strength)));
  const rise = 1 - Math.exp(-1 / (rate * 0.0018));
  let vibration = 0, contact = 0;
  return (rear: number) => {
    const displacement = clamp((rear - (0.018 - 0.010 * strength)) * (2.2 + strength * 2.7), 0, 1);
    vibration = Math.max(displacement, vibration * settling);
    contact += rise * (vibration - contact);
    const noise = white();
    return contact * radiation(0.42 * low(noise) + (0.24 + 0.20 * strength) * high(noise));
  };
}

export function drumVoice(voice: DrumVoice, rate: number, tuning: number, seed: number, strength: number, studio = true): (time: number) => number {
  if (!studio && voice === 'tom') return classicTom(rate, seed, strength);
  const random = rng(seed);
  const white = noise(random, 'white');
  if (voice === 'hat' || voice === 'crash') return cymbal(rate, white, random, strength, voice === 'hat');

  const sound = drums[voice];
  const pitch = voice === 'timpani' ? tuning : sound.frequency * (0.987 + 0.026 * random());
  const position = (0.88 + 0.25 * random()) * (0.56 + 0.57 * strength);
  const damping = 0.93 + 0.14 * random();
  const contact = Math.min(0.65 / pitch, sound.contact * (1.3 - 0.70 * strength));
  const strikeWeight = Math.PI / (2 * contact * rate);
  const beaterTime = Math.min(0.00165, contact * 0.45);
  const primary = drivenMode(rate, pitch, 0.81, sound.decay * damping);
  const pair = sound.pair && drivenMode(rate, pitch * sound.pair[0], sound.pair[1], sound.pair[2] * damping);
  const modes = sound.modes.filter(([ratio]) => ratio * pitch < rate * 0.44)
    .map(([ratio, amplitude, decay]) => drivenMode(rate, ratio * pitch, amplitude * position, decay * damping));
  const shell = drivenMode(rate, sound.shell, 0.092 * position, 0.026 * damping);
  const beater = biquad('bandpass', sound.beater * (0.72 + strength * 0.66), 0.78, rate);
  const wires = voice === 'snare' ? snareWires(rate, strength, white) : undefined;
  const bodyColor = biquad('lowpass', voice === 'snare' ? 3850 : Math.max(pitch * 2.4, 2200 + strength * 680), 0.71, rate);
  return time => {
    const force = time < contact ? Math.sin(Math.PI * time / contact) : 0;
    const strike = force * strikeWeight;
    const fundamental = primary(strike), coupled = pair?.(strike) ?? 0;
    const rear = pair ? 0.48 * fundamental - 0.72 * coupled : 0;
    let head = fundamental + coupled;
    for (const mode of modes) head += mode(strike);
    const tap = time < beaterTime ? Math.sin(Math.PI * time / beaterTime) : 0;
    const friction = force ? (0.35 * force + (0.22 + 0.44 * strength) * tap) * white() : 0;
    const impact = (0.23 + 0.24 * strength) * beater(friction);
    return bodyColor(0.70 * head + 0.25 * rear + shell(strike)) + impact + (wires?.(rear) ?? 0);
  };
}
