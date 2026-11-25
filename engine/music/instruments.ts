import { noise } from '../dsp.ts';
import { biquad, clamp, makeSVF, pulseOsc, rng, sawOsc, sineOsc, triangleOsc, TAU } from './dsp.ts';
import { drumVoice, isDrumVoice } from './drums.ts';
import { nylonVoice, tineVoice } from './keys-and-strings.ts';
import { createOrchestralVoice, orchestralEnvelopes, type VoiceCharacter } from './orchestra.ts';
import type { Articulation, DrumSound, Instrument } from './score.ts';

type Envelope = { attack: number; decay: number; sustain: number; release: number };

const envelopes = {
  ...orchestralEnvelopes,
  bass: { attack: 0.008, decay: 0.15, sustain: 0.73, release: 0.16 },
  pad: { attack: 0.24, decay: 0.6, sustain: 0.82, release: 0.85 },
  pluck: { attack: 0.004, decay: 0.34, sustain: 0.2, release: 0.33 },
  chip: { attack: 0.003, decay: 0.13, sustain: 0.46, release: 0.09 },
  'nylon-guitar': { attack: 0.004, decay: 0.24, sustain: 0.78, release: 0.25 },
  'electric-piano': { attack: 0.005, decay: 0.23, sustain: 0.79, release: 0.31 },
  kick: { attack: 0.002, decay: 0.28, sustain: 1, release: 0.10 },
  snare: { attack: 0.002, decay: 0.24, sustain: 1, release: 0.09 },
  hat: { attack: 0.001, decay: 0.12, sustain: 1, release: 0.06 },
  tom: { attack: 0.003, decay: 0.28, sustain: 0.86, release: 0.28 },
} satisfies Record<Exclude<Instrument, 'drums'> | DrumSound, Envelope>;

export function noteEnvelope(voice: keyof typeof envelopes, articulation: Articulation | undefined, rate: number, frames: number) {
  const base = envelopes[voice];
  let envelope: Envelope = base;
  let hold = frames;
  switch (articulation) {
    case 'short':
      hold = Math.min(hold, Math.round(rate * 0.14));
      envelope = { attack: Math.min(base.attack, 0.018), decay: 0.064, sustain: 0.58, release: Math.min(base.release, 0.095) };
      break;
    case 'mute':
      hold = Math.min(hold, Math.round(rate * 0.16));
      envelope = { ...base, decay: 0.10, sustain: 0.45, release: 0.08 };
      break;
    case 'accent':
      envelope = { ...base, attack: Math.max(0.001, base.attack * 0.42), decay: base.decay * 0.6, sustain: base.sustain * 0.80 };
      break;
    case 'swell':
      envelope = { ...base, attack: Math.max(base.attack, hold * 0.72 / rate) };
      break;
    case 'legato':
      envelope = { ...base, attack: Math.min(base.attack, 0.032) };
      break;
  }
  return { envelope, hold };
}

export function createVoice(
  voice: keyof typeof envelopes, rate: number, hz: number, seed: number, character: VoiceCharacter = { velocity: 0.8 },
): (time: number) => number {
  if (voice === 'tom') return drumVoice(voice, rate, hz, seed, character.velocity);
  if (character.studio && isDrumVoice(voice)) return drumVoice(voice, rate, hz, seed, character.velocity);
  if (voice === 'nylon-guitar') return nylonVoice(rate, hz, seed, character.velocity);
  if (voice === 'electric-piano') return tineVoice(rate, hz, seed, character.velocity);
  const sine = sineOsc(rate);
  switch (voice) {
    case 'kick':
      return time => 0.94 * Math.exp(-time / 0.083) * sine(50 + 112 * Math.exp(-time / 0.016));
    case 'snare': {
      const source = noise(rng(seed), 'white');
      const body = biquad('bandpass', 1650, 0.6, rate);
      const air = biquad('highpass', 3900, 0.7, rate);
      return time => {
        const sample = source();
        return (0.82 * body(sample) + 0.34 * air(sample)) * Math.exp(-time / 0.056) +
          0.24 * sine(168 + 46 * Math.exp(-time / 0.018)) * Math.exp(-time / 0.030);
      };
    }
    case 'hat': {
      const source = noise(rng(seed), 'white');
      const brightness = biquad('highpass', 6800, 0.72, rate);
      return time => 0.52 * brightness(source()) * Math.exp(-time / 0.038);
    }
    case 'bass': {
      const triangle = triangleOsc(rate);
      if (character.studio) {
        const second = sineOsc(rate), third = sineOsc(rate);
        const octaveGain = 2 * hz < rate * 0.45 ? 0.095 + 0.08 * character.velocity : 0;
        const thirdGain = 3 * hz < rate * 0.45 ? 1 : 0;
        return time => 0.51 * sine(hz) + octaveGain * second(2 * hz) +
          thirdGain * (0.031 + 0.11 * character.velocity * Math.exp(-time / 0.11)) * third(3 * hz);
      }
      return time => 0.59 * sine(hz) - triangle(hz) * (0.08 + 0.13 * Math.exp(-time / 0.09));
    }
    case 'pad': {
      if (character.studio) {
        const random = rng(seed);
        const lower = sawOsc(rate, random()), upper = sawOsc(rate, random());
        const movement = random() * TAU;
        const filter = biquad('lowpass', Math.min(rate * 0.18, Math.max(730, hz * (1.8 + character.velocity))), 0.66, rate);
        return time => {
          const drift = Math.sin(movement + TAU * 0.29 * time) * 0.0018;
          return filter(0.36 * sine(hz) + 0.145 * lower(hz * (0.9971 + drift)) + 0.14 * upper(hz * (1.0026 - drift)));
        };
      }
      const lower = sawOsc(rate);
      const upper = sawOsc(rate);
      const filter = biquad('lowpass', Math.min(rate * 0.26, Math.max(1150, hz * 2.6)), 0.75, rate);
      return time => {
        const modulation = Math.sin(TAU * 0.53 * time);
        return filter(0.33 * lower(hz * (0.997 + modulation * 0.0015)) +
          0.29 * upper(hz * (1.004 - modulation * 0.001)) + 0.2 * sine(hz));
      };
    }
    case 'pluck': {
      const filter = makeSVF(rate);
      const modulator = sineOsc(rate);
      const index = (character.studio ? 0.55 + 1.25 * character.velocity : 1.5) * clamp((rate / 2 - 2 * hz) / (4 * hz), 0, 1);
      let phase = 0;
      return time => {
        const modulation = modulator(2 * hz) * index * Math.exp(-time / 0.075);
        const sample = 0.66 * Math.sin(TAU * phase + modulation);
        phase += hz / rate;
        if (phase >= 1) phase -= 1;
        const cutoff = Math.max(hz * 1.45, 2100 + 5000 * Math.exp(-time / 0.085));
        return filter(sample, cutoff, 0.78).low * (0.32 + 0.68 * Math.exp(-time / 0.21));
      };
    }
    case 'chip': {
      const pulse = pulseOsc(rate);
      const filter = biquad('lowpass', Math.min(rate * 0.35, Math.max(5200, hz * 2.5)), 0.7, rate);
      return time => {
        const width = 0.31 + 0.035 * Math.sin(TAU * 3.2 * time);
        return filter(0.39 * (pulse(hz, width) - (2 * width - 1)) + 0.21 * sine(hz));
      };
    }
    default: return createOrchestralVoice(voice, rate, hz, seed, character);
  }
}
