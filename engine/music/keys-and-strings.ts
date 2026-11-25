import { biquad, clamp, rng, TAU } from './dsp.ts';
import type { Articulation } from './score.ts';

type Mode = readonly [frequency: number, amplitude: number, decay: number];

function resonances(rate: number, definitions: readonly Mode[]) {
  const modes = definitions.filter(([hz]) => hz < 0.43 * rate).map(([hz, amplitude, decay]) => {
    const radians = TAU * hz / rate;
    const loss = Math.exp(-1 / (decay * rate));
    return { real: amplitude, imaginary: 0, cosine: Math.cos(radians) * loss, sine: Math.sin(radians) * loss };
  });
  return () => {
    let signal = 0;
    for (const mode of modes) {
      const real = mode.real;
      signal += mode.imaginary;
      mode.real = real * mode.cosine - mode.imaginary * mode.sine;
      mode.imaginary = real * mode.sine + mode.imaginary * mode.cosine;
    }
    return signal;
  };
}

export function nylonVoice(rate: number, hz: number, seed: number, velocity: number) {
  const random = rng(seed);
  const position = 0.19 + 0.055 * random() - 0.045 * velocity;
  const body = [biquad('bandpass', 184, 2.0, rate), biquad('bandpass', 416, 2.7, rate), biquad('bandpass', 715, 3.1, rate)];
  const string = resonances(rate, Array.from({ length: 15 }, (_, i): Mode => {
    const n = i + 1;
    const strength = 0.79 * Math.sin(Math.PI * position * n) / (Math.sin(Math.PI * position) * n ** (1.66 - 0.36 * velocity));
    return [hz * n * Math.sqrt((1 + 0.000018 * n * n) / 1.000018), strength, (1.18 - 0.23 * velocity) / n ** 0.77];
  }));
  const touch = biquad('bandpass', 2070, 0.75, rate);
  return (time: number) => {
    const pluck = string();
    const contact = time < 0.047 ? touch(2 * random() - 1) * (0.05 + 0.1 * velocity) * Math.exp(-time / 0.011) : 0;
    const drive = pluck + 1.8 * contact;
    return 0.48 * pluck + 0.20 * body[0](drive) + 0.30 * body[1](drive) + 0.14 * body[2](drive) + contact;
  };
}

const openGuitarStrings = [329.628, 246.942, 195.998, 146.832, 110, 82.407];

function guitarString(rate: number, hz: number, random: () => number, velocity: number, muted: boolean, electric: boolean) {
  const open = openGuitarStrings.find(pitch => pitch <= hz * 1.001) ?? 82.407;
  const fretRatio = clamp(hz / open, 1, 4);
  const pluckPoint = Math.PI * clamp(
    ((electric ? 0.152 : 0.203) - 0.049 * velocity + 0.029 * random()) * Math.sqrt(fretRatio),
    0.07, 0.40,
  );
  const pluckFundamental = Math.sin(pluckPoint);
  const pickupA = Math.PI * clamp(0.093 * fretRatio, 0.08, 0.39);
  const pickupB = Math.PI * clamp(0.151 * fretRatio, 0.14, 0.58);
  const pickup = (harmonic: number) => 0.58 * Math.sin(pickupA * harmonic) + 0.42 * Math.sin(pickupB * harmonic);
  const pickupFundamental = pickup(1);
  const stiffness = (electric ? 0.000031 : 0.000013) * Math.sqrt(fretRatio);
  const register = clamp(Math.log2(hz / 82.407) / 4, 0, 1);
  const ring = muted ? (electric ? 0.076 : 0.068) : (electric ? 1.42 : 0.88) - 0.38 * register;
  const bandwidth = (electric ? 1600 : 1000) + 3400 * velocity ** 1.5 + 0.9 * hz;
  const fundamentalContact = 1 + (hz / bandwidth) ** 2;
  const modes: Mode[] = [];
  for (let harmonic = 1; harmonic <= 22; harmonic++) {
    const frequency = hz * harmonic * Math.sqrt((1 + stiffness * harmonic ** 2) / (1 + stiffness));
    if (frequency >= rate * 0.43) break;
    const pluck = Math.sin(pluckPoint * harmonic) / (pluckFundamental * harmonic ** 1.76);
    const contact = fundamentalContact / (1 + (frequency / bandwidth) ** 2);
    const colour = electric ? pickup(harmonic) / pickupFundamental : 1;
    const gain = 0.66 * pluck * contact * colour;
    const decay = ring / harmonic ** (muted ? 0.92 : 0.72);
    if (muted || harmonic > 8) {
      modes.push([frequency, gain, decay]);
    } else {
      modes.push([frequency, gain * 0.76, decay * 0.76]);
      modes.push([frequency * (1.00022 + 0.00011 * random()), gain * 0.24, decay * 1.52]);
    }
  }
  return resonances(rate, modes);
}

export function studioNylonGuitar(rate: number, hz: number, seed: number, velocity: number, articulation?: Articulation) {
  const random = rng(seed);
  const muted = articulation === 'mute';
  const string = guitarString(rate, hz, random, velocity, muted, false);
  const body = [[102, 2.8, 0.31], [192, 2.3, 0.37], [246, 2.9, 0.21], [387, 2.2, 0.15], [685, 2.5, 0.12]]
    .map(([frequency, q, gain]) => ({ filter: biquad('bandpass', frequency, q, rate), gain }));
  const touch = biquad('bandpass', 1550 + 1030 * velocity, 0.81, rate);
  const radiation = biquad('lowpass', Math.max(hz * 1.45, muted ? 2840 : 4050 + 970 * velocity), 0.72, rate);
  return (time: number) => {
    const pluck = string();
    const nail = time < 0.035 ? (0.05 + 0.17 * velocity ** 1.7) * touch(2 * random() - 1) * Math.exp(-time / 0.0068) : 0;
    const bridge = pluck + 1.35 * nail;
    let soundboard = 0;
    for (const mode of body) soundboard += mode.gain * mode.filter(bridge);
    return 1.30 * radiation(0.41 * pluck + soundboard + nail);
  };
}

export function studioElectricPickup(rate: number, hz: number, seed: number, velocity: number, articulation?: Articulation) {
  const random = rng(seed);
  const muted = articulation === 'mute';
  const string = guitarString(rate, hz, random, velocity, muted, true);
  const pick = biquad('bandpass', 2140 + 1550 * velocity, 0.95, rate);
  const damping = biquad('lowpass', Math.max(hz * 1.45, 2170), 0.73, rate);
  const stroke = articulation === 'accent' ? 1.17 : 1;
  return (time: number) => {
    const contact = time < 0.027 ? (0.049 + 0.13 * velocity) * pick(2 * random() - 1) * Math.exp(-time / 0.0058) : 0;
    const displacement = string();
    return stroke * ((muted ? damping(displacement) : displacement) + contact);
  };
}

export function studioGuitarAmp(rate: number) {
  const oversampled = rate * 2;
  const input = biquad('highpass', 66, 0.77, oversampled);
  const circuit = biquad('lowpass', 4750, 0.72, oversampled);
  const coupling = biquad('highpass', 34, 0.72, oversampled);
  const cabinet = biquad('lowpass', 4920, 0.71, oversampled);
  const cabinetLow = biquad('bandpass', 112, 1.1, oversampled);
  const cabinetUpper = biquad('bandpass', 1810, 0.85, oversampled);
  const antiAlias = biquad('lowpass', rate * 0.42, 0.71, oversampled);
  const bias = 0.17, resting = Math.tanh(bias);
  const sample = (pickup: number) => {
    const preamp = circuit(Math.tanh(4.7 * input(pickup) + bias) - resting);
    const power = coupling(Math.tanh(1.14 * preamp));
    const response = 0.57 * power + 0.16 * cabinetLow(power) + 0.23 * cabinetUpper(power);
    return 0.68 * antiAlias(cabinet(response));
  };
  let previous = 0;
  return (pickup: number) => {
    sample(0.5 * (previous + pickup));
    previous = pickup;
    return sample(pickup);
  };
}

export function studioElectricGuitar(rate: number, hz: number, seed: number, velocity: number, articulation?: Articulation) {
  const pickup = studioElectricPickup(rate, hz, seed, velocity, articulation);
  const amp = studioGuitarAmp(rate);
  return (time: number) => amp(pickup(time) * velocity);
}

export function tineVoice(rate: number, hz: number, seed: number, velocity: number) {
  const random = rng(seed);
  const fundamental = resonances(rate, [[hz, 0.65, 2.55], [hz * 1.0019, 0.078, 1.25]]);
  const flex = resonances(rate, [[hz * 6.27, 0.04 + 0.19 * velocity ** 2, 0.085], [hz * 17.55, 0.09 * velocity ** 2, 0.026]]);
  const contact = biquad('bandpass', 1360, 1.0, rate);
  const dc = biquad('highpass', 22, 0.7, rate);
  const pickup = (0.14 + 0.32 * velocity ** 2) * Math.max(0, 1 - (4 * hz / rate) ** 2);
  const tremoloPhase = random() * TAU;
  return (time: number) => {
    const tine = fundamental();
    const hammer = time < 0.032 ? contact(2 * random() - 1) * velocity * 0.10 * Math.exp(-time / 0.005) : 0;
    const signal = tine + pickup * (tine * tine - 0.25 * tine * tine * tine) + flex() + hammer;
    return dc(signal) * (0.956 + 0.044 * Math.sin(tremoloPhase + TAU * 3.9 * time));
  };
}

export function studioTineVoice(rate: number, hz: number, seed: number, velocity: number) {
  const random = rng(seed);
  const register = clamp(Math.log2(hz / 55) / 6, 0, 1);
  const force = velocity ** 1.65;
  const ring = 2.72 - 1.95 * register;
  const tine = resonances(rate, [[hz, 0.43, ring], [hz * (1.00045 + 0.00033 * random()), 0.15, ring * 0.57]]);
  const impact = resonances(rate, [
    [hz * 6.27, 0.025 + 0.27 * force, 0.086 - 0.039 * register],
    [hz * 17.55, 0.094 * force, 0.024],
    [752 + 560 * register, 0.023 + 0.031 * force, 0.010],
  ]);
  const quadratic = (0.14 + 0.45 * force) * clamp((rate * 0.48 - 2 * hz) / hz, 0, 1);
  const cubic = 0.24 * clamp((rate * 0.48 - 3 * hz) / hz, 0, 1);
  const pickupScale = 1 / (2 * Math.sin(Math.PI * hz / rate));
  const tone = biquad('lowpass', Math.max(4900 + 1500 * force, 1.5 * hz), 0.72, rate);
  const felt = biquad('bandpass', 1140 + 1160 * force, 0.8, rate);
  let previous = 0;
  return (time: number) => {
    const displacement = tine(), squared = displacement * displacement;
    const flux = displacement + (quadratic - cubic * displacement) * squared;
    const pickup = (flux - previous) * pickupScale;
    previous = flux;
    const contact = time < 0.026 ? (0.015 + 0.13 * force) * felt(2 * random() - 1) * Math.exp(-time / 0.004) : 0;
    return tone(0.96 * pickup + impact() + contact);
  };
}
