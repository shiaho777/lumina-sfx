import { noise } from '../dsp.ts';
import { biquad, clamp, polyBlep, pulseOsc, rng, sawOsc, sineOsc, TAU } from './dsp.ts';
import { studioElectricGuitar } from './keys-and-strings.ts';
import type { Articulation } from './score.ts';

export const orchestralEnvelopes = {
  piano: { attack: 0.004, decay: 0.33, sustain: 0.90, release: 0.42 },
  strings: { attack: 0.075, decay: 0.32, sustain: 0.92, release: 0.31 },
  cello: { attack: 0.068, decay: 0.27, sustain: 0.94, release: 0.29 },
  violin: { attack: 0.048, decay: 0.24, sustain: 0.94, release: 0.23 },
  horn: { attack: 0.066, decay: 0.24, sustain: 0.91, release: 0.22 },
  'electric-guitar': { attack: 0.002, decay: 0.18, sustain: 0.90, release: 0.17 },
  timpani: { attack: 0.003, decay: 0.6, sustain: 0.86, release: 0.72 },
  'low-drum': { attack: 0.003, decay: 0.28, sustain: 0.85, release: 0.34 },
  crash: { attack: 0.009, decay: 0.72, sustain: 0.83, release: 1.04 },
};

export type OrchestralVoice = keyof typeof orchestralEnvelopes;
export interface VoiceCharacter {
  velocity: number;
  articulation?: Articulation;
  studio?: boolean;
  dynamics?: (time: number) => number;
  fromHz?: number;
  gateSeconds?: number;
}

function partial(rate: number, hz: number, gain: number, decay: number, phase = 0): () => number {
  const step = TAU * hz / rate;
  const loss = Math.exp(-1 / (rate * decay));
  const cosine = Math.cos(step) * loss, sine = Math.sin(step) * loss;
  let real = gain * Math.cos(phase), imaginary = gain * Math.sin(phase);
  return () => {
    const sample = imaginary;
    const nextReal = real * cosine - imaginary * sine;
    imaginary = imaginary * cosine + real * sine;
    real = nextReal;
    return sample;
  };
}

function classicPiano(rate: number, hz: number, seed: number, character: VoiceCharacter): (time: number) => number {
  const { velocity } = character;
  const random = rng(seed);
  const modes: (() => number)[] = [];
  const stiffness = 0.0001 + 0.00024 * clamp(hz / 2000, 0, 1);
  const amplitudes = [0.39, 0.32, 0.20, 0.14, 0.10, 0.074, 0.053, 0.036, 0.025, 0.016, 0.011, 0.008];
  for (let i = 0; i < amplitudes.length; i++) {
    const n = i + 1;
    const frequency = hz * n * Math.sqrt((1 + stiffness * n * n) / (1 + stiffness));
    if (frequency >= rate * 0.46) break;
    const attackColor = 0.45 + velocity * 0.55;
    const level = amplitudes[i] * attackColor ** (i * 0.38);
    const decay = (1.28 + 0.75 * clamp(180 / hz, 0, 1)) / (1 + i * 0.73);
    const phase = (random() - 0.5) * 0.12;
    const detune = hz > 105 && hz < 3100 && i < 5 ? frequency * 0.00085 : 0;
    modes.push(partial(rate, frequency - detune * 0.45, level * (detune ? 0.68 : 1), decay, phase));
    if (detune) modes.push(partial(rate, frequency + detune, level * 0.32, decay * 0.85, phase));
  }
  const hammer = noise(random, 'white');
  const felt = biquad('bandpass', Math.min(6000, 1250 + 3600 * velocity), 0.86, rate);
  return time => {
    let sum = 0;
    for (const oscillator of modes) sum += oscillator();
    const knock = time < 0.065 ? felt(hammer()) * (0.05 + velocity * 0.14) * Math.exp(-time / 0.012) : 0;
    return sum * 0.75 + knock;
  };
}

function studioPiano(rate: number, hz: number, seed: number, { velocity }: VoiceCharacter): (time: number) => number {
  const random = rng(seed);
  const register = clamp(Math.log2(hz / 55) / 6.25, 0, 1);
  const stiffness = 0.00008 + 0.00052 * register ** 3;
  const strikePosition = Math.PI * (0.128 - 0.046 * register);
  const hammerBandwidth = 420 + 1260 * register + 3900 * velocity ** 1.8 + hz * (0.64 + 0.54 * velocity);
  const fundamentalWeight = 1 + (hz / hammerBandwidth) ** 2.4;
  const stringDecay = 2.8 - 2.38 * register ** 0.85;
  const unisons = hz < 49 ? [] : hz < 116 ? [1.15] : [-1.48, 1.22];
  const modes: (() => number)[] = [];
  for (let harmonic = 1; harmonic <= 24; harmonic++) {
    const frequency = hz * harmonic * Math.sqrt((1 + stiffness * harmonic ** 2) / (1 + stiffness));
    if (frequency >= rate * 0.44) break;
    const excitation = Math.sin(strikePosition * harmonic) / (Math.sin(strikePosition) * harmonic ** 1.56);
    const felt = fundamentalWeight / (1 + (frequency / hammerBandwidth) ** 2.4);
    const gain = 0.45 * excitation * felt;
    const decay = stringDecay / harmonic ** 0.99;
    const phase = -0.48 + 0.08 * (random() - 0.5);
    const partners = harmonic <= 9 ? unisons : [];
    modes.push(partial(rate, frequency, gain * 0.29, decay, phase));
    modes.push(partial(rate, frequency, gain * (partners.length ? 0.31 : 0.71), decay * 0.31, phase));
    for (const cents of partners) {
      const tuning = 2 ** ((cents + (random() - 0.5) * 0.24) / 1200);
      modes.push(partial(rate, frequency * tuning, gain * 0.4 / unisons.length, decay * 0.72, phase));
    }
  }
  const hammerNoise = noise(random, 'white');
  const felt = biquad('bandpass', 690 + 1800 * velocity + 500 * register, 0.86, rate);
  const board = biquad('bandpass', 292, 1.15, rate);
  const bridge = biquad('bandpass', 1180, 0.89, rate);
  const key = partial(rate, 110 + 80 * register, 0.035 + 0.055 * velocity, 0.009);
  return time => {
    let string = 0;
    for (const mode of modes) string += mode();
    const contact = time < 0.054
      ? (0.04 + 0.11 * velocity) * felt(hammerNoise()) * Math.exp(-time / 0.008) + key()
      : 0;
    return string * 0.76 + 0.21 * board(string + contact) + 0.12 * bridge(string) + 0.57 * contact;
  };
}

function connectedPitch(hz: number, fromHz: number | undefined, time: number): number {
  if (!fromHz || time >= 0.040) return hz;
  const blend = Math.min(1, time / 0.040);
  return hz * (fromHz / hz) ** ((1 - blend) ** 2);
}

function classicBows(rate: number, hz: number, seed: number, character: VoiceCharacter, solo: boolean): (time: number) => number {
  const random = rng(seed);
  const tunings = solo ? [0] : [-7.5, 0, 6.5];
  const voices = tunings.map((cents, i) => ({
    oscillator: sawOsc(rate),
    tuning: 2 ** ((cents + (random() - 0.5) * 2.7) / 1200),
    vibratoRate: 4.9 + random() * 1.35,
    phase: random() * TAU,
    level: solo ? 1 : i === 1 ? 0.42 : 0.29,
  }));
  const fundamental = sineOsc(rate);
  const contact = noise(random, 'white');
  const rosin = biquad('bandpass', solo ? 1620 : 2440, 1.2, rate);
  const body = biquad('bandpass', solo ? 345 : 560, 1.24, rate);
  const presence = biquad('bandpass', solo ? 1020 : 2560, 1.07, rate);
  const color = biquad('lowpass', Math.max(hz * 1.6, (solo ? 1750 : 2320) + 2370 * character.velocity), 0.71, rate);
  const shaped = character.dynamics;
  const soft = shaped ? biquad('lowpass', Math.max(hz * 1.48, solo ? 950 : 1350), 0.72, rate) : color;
  const hard = shaped ? biquad('lowpass', Math.max(hz * 1.75, solo ? 3150 : 4600), 0.71, rate) : color;
  const isShort = character.articulation === 'short';
  const vibratoDepth = solo ? 0.006 : 0.0038;
  return time => {
    const pressure = character.dynamics?.(time) ?? character.velocity;
    const pitch = connectedPitch(hz, character.fromHz, time);
    const vibrato = vibratoDepth * Math.min(1, Math.max(0, (time - 0.06) * 3.5));
    let signal = 0;
    for (const voice of voices) {
      const mod = Math.sin(TAU * voice.vibratoRate * time + voice.phase);
      signal += voice.oscillator(pitch * voice.tuning * (1 + vibrato * mod)) * voice.level;
    }
    const core = 0.63 * signal - (solo ? 0.17 : 0.09) * fundamental(pitch);
    const motion = 1 + Math.sin(time * TAU * (solo ? 0.85 : 0.66)) * 0.044;
    const friction = (0.025 + 0.055 * Math.exp(-time / (isShort ? 0.074 : 0.039))) * rosin(contact());
    const sample = motion * (core + 0.25 * body(core) + 0.28 * presence(core)) + friction;
    if (!shaped) return color(sample);
    return ((1 - pressure) * soft(sample) + pressure * hard(sample)) * (0.73 + 0.34 * pressure);
  };
}

const bowProfiles = {
  cello: {
    tunings: [0], body: [[106, 2.6, 0.23], [190, 2.0, 0.32], [297, 2.3, 0.27], [473, 1.9, 0.19], [1580, 0.91, 0.21]],
    scrape: 1780, corner: 900, air: 4200, position: 0.13, depth: 0.0043, attack: 0.046, gain: 0.82,
  },
  violin: {
    tunings: [0], body: [[279, 3.4, 0.18], [459, 2.9, 0.31], [547, 2.8, 0.36], [2470, 0.83, 0.42], [3530, 1.8, 0.12]],
    scrape: 2950, corner: 1360, air: 5300, position: 0.10, depth: 0.0059, attack: 0.032, gain: 0.88,
  },
  strings: {
    tunings: [-6.3, -2.4, 0, 3.2, 6.7], body: [[218, 1.5, 0.19], [360, 2.0, 0.25], [561, 1.6, 0.26], [2120, 0.75, 0.31]],
    scrape: 2250, corner: 1070, air: 4500, position: 0.12, depth: 0.0035, attack: 0.058, gain: 0.57,
  },
};

function bridgeForce(rate: number, phase: number) {
  let rounded = 0;
  return (hz: number, rounding: number, bowPoint: number, extraSlip: number) => {
    const step = hz / rate;
    const basic = 2 * phase - 1 - polyBlep(phase, step);
    const reflected = phase >= bowPoint ? phase - bowPoint : phase + 1 - bowPoint;
    const slip = 2 * reflected - 1 - polyBlep(reflected, step);
    rounded += rounding * (basic + extraSlip * (slip - basic) - rounded);
    phase += step;
    if (phase >= 1) phase -= 1;
    return rounded;
  };
}

function studioBows(voice: keyof typeof bowProfiles, rate: number, hz: number, seed: number, character: VoiceCharacter): (time: number) => number {
  const random = rng(seed);
  const profile = bowProfiles[voice];
  const connected = character.fromHz !== undefined;
  const immediate = connected || character.articulation === 'short' || character.articulation === 'accent';
  const gripTime = character.studio ? Math.min(profile.attack, Math.max(0.002, (character.gateSeconds ?? Infinity) * 0.55)) : profile.attack;
  const voices = profile.tunings.map(cents => ({
    string: bridgeForce(rate, random()),
    tuning: 2 ** (cents / 1200),
    weight: cents === 0 ? 1 : 0.23,
    vibratoRate: 4.7 + 1.2 * random(),
    vibratoPhase: random() * TAU,
    attack: gripTime * (0.78 + 0.44 * random()) * (immediate ? 0.54 : 1),
  }));
  const normalization = 1 / Math.sqrt(voices.reduce((sum, source) => sum + source.weight ** 2, 0));
  const bowHair = noise(random, 'white');
  const rosin = biquad('bandpass', profile.scrape, 0.79, rate);
  const radiation = biquad('lowpass', Math.max(hz * 1.48, profile.air), 0.71, rate);
  const body = profile.body.map(([frequency, q, weight]) => ({
    filter: biquad('bandpass', frequency, q, rate), weight,
  }));
  const gesture = random() * TAU;
  return time => {
    const pressure = character.dynamics?.(time) ?? character.velocity;
    const travel = Math.sin(time * TAU * 0.71 + gesture);
    const bowPoint = profile.position * (1.26 - 0.51 * pressure + 0.11 * travel);
    const bandwidth = Math.max(hz * (1.25 + 0.69 * pressure), profile.corner * (0.62 + 2.70 * pressure ** 1.6));
    const rounding = 1 - Math.exp(-TAU * bandwidth / rate);
    const vibrato = profile.depth * clamp((time - (connected ? 0.031 : 0.092)) * 4.6, 0, 1);
    let force = 0;
    for (const source of voices) {
      const mod = Math.sin(TAU * source.vibratoRate * time + source.vibratoPhase + 0.21 * travel);
      const grip = connected ? 1 : clamp(time / (source.attack * (1.15 - 0.48 * pressure)), 0, 1);
      const slip = 0.61 * bowPoint + 0.29 * (1 - grip) ** 2;
      const pitch = hz * source.tuning * (1 + vibrato * mod);
      force += source.string(pitch, rounding, bowPoint, slip) * (0.54 + 0.46 * grip) * source.weight;
    }
    force *= normalization;
    let tone = 0.55 * force;
    for (const mode of body) tone += mode.weight * mode.filter(force);
    const catchNoise = connected ? 0 : 0.12 * Math.exp(-time / (gripTime * 0.54));
    const air = (0.012 + 0.021 * pressure + catchNoise) * rosin(bowHair());
    return profile.gain * ((0.70 + 0.45 * pressure + 0.027 * travel) * radiation(tone) + air);
  };
}

function classicHorn(rate: number, hz: number, seed: number, character: VoiceCharacter): (time: number) => number {
  const random = rng(seed);
  const phaseOffset = random() * TAU;
  const harmonics = [0.59, 0.32, 0.23, 0.15, 0.093, 0.051, 0.029, 0.016].map((level, i) => {
    const n = i + 1;
    const frequency = n * hz;
    const body = Math.exp(-(((frequency - 960) / 620) ** 2));
    return level * (0.8 + 0.58 * body) * clamp(4 - 8 * frequency / rate, 0, 1);
  });
  const accent = character.articulation === 'accent' ? 0.19 : 0;
  const bright = 0.35 + 0.74 * character.velocity + accent;
  const filter = biquad('lowpass', Math.max(hz * 1.5, 1210 + character.velocity * 2700), 0.72, rate);
  let phase = 0;
  return time => {
    const pressure = character.dynamics?.(time);
    const bloom = 0.65 + 0.35 * Math.min(1, 9 * time);
    let sum = harmonics[0] * Math.sin(phase);
    let weight = (pressure === undefined ? bright : 0.29 + 0.89 * pressure + accent) * bloom;
    for (let i = 1; i < harmonics.length; i++) {
      sum += harmonics[i] * weight * Math.sin((i + 1) * phase + i * 0.22);
      weight *= 0.86;
    }
    const vibration = 1 + 0.0026 * Math.min(1, time * 2) * Math.sin(TAU * 5.2 * time + phaseOffset);
    phase += TAU * connectedPitch(hz, character.fromHz, time) / rate * vibration;
    if (phase > TAU) phase -= TAU;
    return filter(sum * 0.82) * (pressure === undefined ? 1 : 0.75 + 0.30 * pressure);
  };
}

function studioHorn(rate: number, hz: number, seed: number, character: VoiceCharacter): (time: number) => number {
  const random = rng(seed);
  const phase = random() * TAU;
  const connected = character.fromHz !== undefined;
  const accent = character.articulation === 'accent' ? 0.13 : 0;
  const onset = Math.min(connected ? 0.010 : accent ? 0.017 : 0.036,
    Math.max(0.002, (character.gateSeconds ?? Infinity) * 0.52));
  const fundamental = sineOsc(rate);
  const lips = pulseOsc(rate);
  const air = noise(random, 'white');
  const mouthpiece = biquad('bandpass', 840, 1.03, rate);
  const bore = biquad('bandpass', 445, 0.86, rate);
  const breath = biquad('bandpass', 1400 + 820 * character.velocity, 0.78, rate);
  const bell = biquad('lowpass', Math.max(hz * 1.75, 3220), 0.72, rate);
  const smoothing = 1 - Math.exp(-1 / (rate * 0.012));
  let pressure = character.dynamics?.(0) ?? character.velocity;
  return time => {
    const target = character.dynamics?.(time) ?? character.velocity;
    pressure += (target - pressure) * smoothing;
    const articulation = Math.exp(-time / onset);
    const airflow = clamp(pressure + accent * articulation, 0, 1);
    const buzz = airflow ** 1.75;
    const aperture = 0.39 - 0.18 * buzz;
    const drift = 0.0010 * Math.min(1, time * 3.8) * Math.sin(TAU * 4.75 * time + phase);
    const pitch = hz * (1 + drift);
    const lip = 2 * aperture - 1 - lips(pitch, aperture);
    const excitation = 0.46 * fundamental(pitch) + (0.052 + 0.38 * buzz) * lip;
    const lock = 1 - (connected ? 0.12 : 0.54) * articulation;
    const tone = excitation * 0.64 + bore(excitation) * 0.24 + mouthpiece(excitation) * (0.11 + 0.21 * buzz);
    const breathGain = 0.009 + 0.012 * airflow + (connected ? 0 : 0.093 + accent * 0.39) * articulation;
    return bell((0.68 + 0.31 * airflow) * lock * tone + breathGain * breath(air()));
  };
}

function classicGuitar(rate: number, hz: number, seed: number, character: VoiceCharacter): (time: number) => number {
  const random = rng(seed);
  const muted = character.articulation === 'mute';
  const delay = Math.max(2, rate / hz - 0.5);
  const integer = Math.floor(delay), fraction = delay - integer;
  const length = integer + 2;
  const pick = 0.16 + random() * 0.11;
  const line = Float64Array.from({ length }, (_, i) => {
    const position = i / length;
    const bend = position < pick ? position / pick : (1 - position) / (1 - pick);
    return 0.58 * (bend - 0.5) + (random() - 0.5) * (0.18 + 0.22 * character.velocity);
  });
  const loss = Math.exp(-1 / (hz * (muted ? 0.082 : 1.8)));
  const preamp = biquad('highpass', 68, 0.75, rate);
  const speaker = biquad('lowpass', Math.max(hz * 1.15, muted ? 3050 : 4630), 0.77, rate);
  const drive = 2.2 + 2.9 * character.velocity + (character.articulation === 'accent' ? 0.75 : 0);
  let index = 0, previous = 0;
  return time => {
    let read = index - integer;
    if (read < 0) read += length;
    const value = line[read] * (1 - fraction) + line[read === 0 ? length - 1 : read - 1] * fraction;
    line[index] = 0.5 * (value + previous) * loss;
    previous = value;
    if (++index === length) index = 0;
    const cabinet = speaker(Math.tanh(preamp(value) * drive));
    return cabinet * (0.54 + 0.10 * Math.exp(-time / 0.049));
  };
}

function membrane(rate: number, hz: number, seed: number, tuned: boolean): (time: number) => number {
  const random = rng(seed);
  const stick = noise(random, 'white');
  const edge = biquad('bandpass', tuned ? 1680 : 930, 0.9, rate);
  const modes = tuned
    ? [[1, 0.65, 0.52], [1.5, 0.33, 0.28], [2, 0.16, 0.17], [2.44, 0.10, 0.11], [2.93, 0.055, 0.08]]
    : [[1, 0.78, 0.21], [1.58, 0.23, 0.12], [2.14, 0.15, 0.10], [3.08, 0.045, 0.06]];
  const oscillators = modes.filter(([ratio]) => ratio * hz < rate * 0.46)
    .map(([ratio, gain, decay]) => partial(rate, hz * ratio, gain, decay, (random() - 0.5) * 0.06));
  return time => {
    let tone = 0;
    for (const oscillator of oscillators) tone += oscillator();
    return tone * 0.83 + (time < 0.12 ? 0.27 * edge(stick()) * Math.exp(-time / 0.024) : 0);
  };
}

function crash(rate: number, seed: number): (time: number) => number {
  const random = rng(seed);
  const metal = noise(random, 'white');
  const sheen = biquad('highpass', 4050, 0.77, rate);
  const wash = biquad('bandpass', 7310, 0.69, rate);
  const modes = [423, 671, 1070, 1561, 2363, 3541, 4811, 6301].map((hz, i) =>
    partial(rate, hz * (0.994 + 0.012 * random()), 0.027 - i * 0.0015, 0.54 - i * 0.037, random() * TAU));
  return time => {
    const strike = metal();
    let ring = 0;
    for (const mode of modes) ring += mode();
    return ring + 0.27 * wash(strike) * Math.exp(-time / 0.42) + 0.23 * sheen(strike) * Math.exp(-time / 0.15);
  };
}

export function createOrchestralVoice(
  voice: OrchestralVoice, rate: number, hz: number, seed: number, character: VoiceCharacter,
): (time: number) => number {
  switch (voice) {
    case 'piano': return (character.studio ? studioPiano : classicPiano)(rate, hz, seed, character);
    case 'strings':
    case 'cello':
      return character.studio ? studioBows(voice, rate, hz, seed, character) : classicBows(rate, hz, seed, character, voice === 'cello');
    case 'violin': return studioBows(voice, rate, hz, seed, character);
    case 'horn': return (character.studio ? studioHorn : classicHorn)(rate, hz, seed, character);
    case 'electric-guitar': return character.studio
      ? studioElectricGuitar(rate, hz, seed, character.velocity, character.articulation)
      : classicGuitar(rate, hz, seed, character);
    case 'timpani': return membrane(rate, hz, seed, true);
    case 'low-drum': return membrane(rate, 51, seed, false);
    case 'crash': return crash(rate, seed);
  }
}
