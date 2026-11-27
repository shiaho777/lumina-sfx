import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-city-bus-engine-idle-loop.ts';
import power from './_recordings/isolated-response-diesel-loaded.ts';

export default {
  id: 'transit-bus-steady-cruise-loop',
  name: 'Transit bus diesel at a steady road speed',
  category: 'Vehicles & Engines',
  tags: ['city', 'transit', 'bus', 'diesel', 'engine', 'cruise', 'steady', 'road', 'loop'],
  isolation: 'isolated',
  components: ['bus-engine'],
  soloQueries: ['city bus cruising', 'transit bus engine cruising'],
  perspective: 'stationary exterior emitter',
  sustainMode: 'evolving',
  loopable: true,
  durationSec: 3.84,
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
      'cruise',
      {
        kind: 'diesel',
        pulseHz: [15, 82],
        timbre: 0.44,
        idleWindow: [0.04, 0.96],
        powerWindow: [0.11, 0.93],
      },
      idle,
      power,
    );
  },
} satisfies SoundRecipe;
