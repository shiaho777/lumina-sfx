import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-demo-turbine-idle.ts';
import power from './_recordings/isolated-demo-fighter-rise.ts';

export default {
  id: 'light-jet-taxi-thrust-loop',
  name: 'Light jet at steady taxi thrust',
  category: 'Aircraft',
  tags: [
    'aircraft',
    'jet',
    'turbine',
    'turbofan',
    'engine',
    'taxi',
    'steady',
    'low',
    'throttle',
    'ramp',
    'loop',
  ],
  isolation: 'isolated',
  components: ['jet-engine'],
  soloQueries: ['jet taxi engine', 'jet turbine taxiing'],
  perspective: 'stationary exterior emitter',
  sustainMode: 'evolving',
  loopable: true,
  durationSec: 4.15,
  targetRmsDbfs: -24,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: 0.5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: 0.55 },
  },
  ...sceneCredits(idle, power),
  render(ctx, { seed, params }) {
    return propulsion(
      ctx,
      seed,
      params.intensity,
      params.rpm,
      'idle',
      {
        kind: 'jet',
        pulseHz: [156, 510],
        timbre: 0.56,
        idleWindow: [0.04, 0.94],
        powerWindow: [0.08, 0.96],
      },
      idle,
      power,
    );
  },
} satisfies SoundRecipe;
