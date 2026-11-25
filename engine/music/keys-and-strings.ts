import { biquad, rng, TAU } from './dsp.ts';

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
