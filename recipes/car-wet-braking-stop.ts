import { biquad, noise } from '../engine/dsp.ts';
import { sustain } from './_shared/field-layers.ts';
import type { SoundRecipe } from '../engine/types.ts';
import recording from './_recordings/isolated-tire-scrub.ts';

export default {
  id: 'car-wet-braking-stop', name: 'Car Braking on Wet Road', category: 'Vehicles & Engines',
  tags: ['car', 'tire', 'brake', 'stop', 'wet'], loopable: false, durationSec: 2.35,
  params: { pace: { label: 'Pace', min: 0, max: 1, default: 0.5 } },
  targetRmsDbfs: -22,
  isolation:'isolated', components:['tire-braking'],
  recording: recording.credit,
  render(ctx, { seed, params }) {
    const tire = sustain(ctx, recording, seed, .91 + params.pace * .20, 6700);
    const spray = biquad('bandpass', 2900, .58, ctx.sampleRate), hiss = noise(ctx.random, 'white');
    return tire.map((value,i) => {
      const t = i / tire.length, speed = (1 - t) ** 1.4;
      return (value * (.30 + .70 * Math.sin(Math.PI * t) ** .65) + spray(hiss()) * .055 * speed) * speed;
    });
  },
} satisfies SoundRecipe;
