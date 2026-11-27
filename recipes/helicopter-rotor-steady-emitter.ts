import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-demo-rotor-bed.ts';

export default {
  id: 'helicopter-rotor-steady-emitter',
  name: 'Helicopter main rotor at steady collective',
  category: 'Aircraft',
  tags: ['aircraft', 'rotor', 'engine', 'cruise', 'rescue', 'helicopter', 'forward', 'flight', 'loop'],
  isolation: 'isolated',
  components: ['helicopter'],
  soloQueries: ['helicopter rotor'],
  perspective: 'stationary exterior emitter',
  sustainMode: 'evolving',
  loopable: true,
  durationSec: 4.03,
  targetRmsDbfs: -24,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: 0.5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: 0.55 },
  },
  ...sceneCredits(idle),
  render(ctx, { seed, params }) {
    return propulsion(
      ctx,
      seed,
      params.intensity,
      params.rpm,
      'cruise',
      {
        kind: 'rotor',
        pulseHz: [14, 23],
        timbre: 0.61,
        idleWindow: [0.16, 0.71],
        powerWindow: [0.36, 0.94],
      },
      idle,
      idle,
    );
  },
} satisfies SoundRecipe;
