import type { SoundRecipe } from '../engine/types.ts';
import { sustain } from './_shared/field-layers.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import engine from './_recordings/isolated-motorcycle-under-load.ts';

export default {
  id: 'motorcycle-steady-engine-loop',
  name: 'Steady road motorcycle engine',
  category: 'Vehicles & Engines',
  tags: [
    'vehicle',
    'motorcycle',
    'motorbike',
    'piston',
    'engine',
    'cruise',
    'single',
    'cylinder',
    'road',
    'bike',
    'pace',
    'loop',
  ],
  isolation: 'isolated',
  components: ['motorcycle-engine'],
  soloQueries: ['motorcycle engine', 'motorbike engine'],
  perspective: 'stationary exterior emitter',
  sustainMode: 'evolving',
  loopable: true,
  durationSec: 2.68,
  targetRmsDbfs: -24,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: 0.5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: 0.55 },
  },
  ...sceneCredits(engine),
  render(ctx, { seed, params }) {
    // A single microphone captures the exhaust stroke and its harmonics in phase.
    // Load opens the exhaust tone while shaft speed controls the recorded pulse rate.
    const motor = sustain(ctx, engine, seed, 0.76 + 0.54 * params.rpm, 2050 + 4600 * params.intensity);
    // This emitter represents a held throttle. Level the slower microphone swell before
    // it is placed in the world, leaving each exhaust pulse and the scene's gain intact.
    const radius = Math.max(1, Math.round(ctx.sampleRate * 0.17));
    let power = 0;
    for (let j = 0; j < Math.min(radius, motor.length); j++) power += motor[j] ** 2;
    const out = new Float32Array(motor.length);
    for (let i = 0; i < motor.length; i++) {
      if (i + radius < motor.length) power += motor[i + radius] ** 2;
      if (i > radius) power -= motor[i - radius - 1] ** 2;
      const width = Math.min(motor.length, i + radius + 1) - Math.max(0, i - radius);
      const rms = Math.sqrt(Math.max(power / width, 1e-8));
      const gain = Math.max(0.18, Math.min(4.5, (0.065 / rms) ** 0.9));
      out[i] = motor[i] * gain;
    }
    return out;
  },
} satisfies SoundRecipe;
