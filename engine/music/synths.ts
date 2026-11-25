import { biquad, clamp, makeSVF, pulseOsc, rng, sawOsc, sineOsc, triangleOsc, TAU } from './dsp.ts';

export function studioSynth(voice: 'bass' | 'pad' | 'pluck' | 'chip', rate: number, hz: number, seed: number, velocity: number) {
  const random = rng(seed);
  const fundamental = sineOsc(rate);
  switch (voice) {
    case 'bass': {
      const oscillator = sawOsc(rate);
      const filter = makeSVF(rate);
      const cutoff = Math.max(hz * 2.4, 134 + 177 * velocity);
      const sweep = 245 + 1740 * velocity ** 1.6;
      return (time: number) => {
        const buzz = filter(-oscillator(hz), cutoff + sweep * Math.exp(-time / 0.088), 0.84).low;
        return 0.35 * fundamental(hz) + (0.27 + 0.13 * velocity) * buzz;
      };
    }
    case 'pad': {
      const center = triangleOsc(rate);
      const left = sawOsc(rate, random()), right = sawOsc(rate, random());
      const filter = makeSVF(rate);
      const phase = TAU * random();
      const width = 0.0026 + 0.0019 * velocity;
      const opening = Math.max(hz * 1.55, 495 + velocity * 580);
      return (time: number) => {
        const cycle = Math.sin(phase + time * TAU * 0.31);
        const drift = 0.00076 * Math.sin(-0.52 * phase + time * TAU * 0.19);
        const bloom = 1 - Math.exp(-time / 0.43);
        const spread = -left(hz * (1 - width + drift)) - right(hz * (1 + width + drift));
        const tone = 0.33 * center(hz) + (0.12 + 0.024 * cycle + 0.042 * bloom) * spread;
        return filter(tone, opening + (0.21 * bloom + 0.059 * cycle) * opening, 0.72).low;
      };
    }
    case 'pluck': {
      const overtone = sineOsc(rate), strike = sineOsc(rate);
      const filter = makeSVF(rate);
      const headroom = clamp((rate * 0.47 - 3 * hz) / (5 * hz), 0, 1);
      const depth = (0.43 + 1.54 * velocity ** 1.45) * headroom;
      const edge = (0.06 + 0.26 * velocity) * headroom;
      const register = clamp(Math.log2(hz / 130.813) / 4, 0, 1);
      let phase = 0;
      return (time: number) => {
        const bright = Math.exp(-time / (0.102 - 0.037 * register));
        const shimmer = strike(hz * 2.77) * edge * Math.exp(-time / 0.028);
        const modulation = overtone(2 * hz) * depth * bright + shimmer;
        const body = Math.sin(TAU * phase + modulation);
        phase = (phase + hz / rate) % 1;
        const cutoff = Math.max(hz * 1.7, 1250 + (1350 + 2840 * velocity) * bright);
        return filter(body, cutoff, 0.76).low * (0.22 + 0.52 * Math.exp(-time / (0.31 - 0.11 * register)));
      };
    }
    case 'chip': {
      const pulse = pulseOsc(rate);
      const phase = TAU * random();
      const width = 0.40 - 0.15 * velocity;
      const colour = biquad('lowpass', Math.max(hz * 1.62, 4380 + velocity * 3030), 0.72, rate);
      return (time: number) => {
        const duty = width - 0.054 * Math.exp(-time / 0.022) + 0.015 * Math.sin(phase + time * TAU * 2.3);
        const tone = pulse(hz, duty) - (2 * duty - 1);
        return colour(0.37 * tone - 0.056 * fundamental(hz));
      };
    }
  }
}
