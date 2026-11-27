import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-tractor-diesel-idle-loop.ts';
import loaded from './_recordings/isolated-response-diesel-loaded.ts';

export default {
  id: 'tractor-diesel-steady-emitter',
  name: 'Tractor diesel under a steady field load',
  category: 'Vehicles & Engines',
  tags: ['vehicle', 'diesel', 'engine', 'cruise', 'orchard', 'tractor', 'farm', 'lane', 'transit', 'loop'],
  isolation: 'isolated',
  components: ['tractor'],
  soloQueries: ['tractor engine'],
  perspective: 'stationary exterior emitter',
  sustainMode: 'evolving',
  loopable: true,
  durationSec: 3.54,
  targetRmsDbfs: -24,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: 0.5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: 0.55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(
      ctx,
      seed,
      params.intensity,
      params.rpm,
      'cruise',
      {
        kind: 'diesel',
        pulseHz: [22, 115],
        timbre: 0.53,
        idleWindow: [0.12, 0.88],
        powerWindow: [0.16, 0.85],
      },
      idle,
      loaded,
    );
  },
} satisfies SoundRecipe;
