import { propulsion } from './_shared/propulsion.ts';
import type { SoundRecipe } from '../engine/types.ts';
import engine from './_recordings/isolated-milestone-prop-steady.ts';

export default {
  id: "light-propeller-plane-cockpit-loop",
  name: "Light Propeller Plane Cockpit",
  category: "Aircraft",
  tags: ["light", "propeller", "plane", "cockpit"],
  loopable: true,
  durationSec: 8.0,
  targetRmsDbfs: -29,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  recording: engine.credit, isolation: 'isolated', components: ['prop-engine'],
  render(ctx, { params, seed }) {
    return propulsion(ctx, seed, params.intensity, .55, 'cabin', {
      kind: 'prop', pulseHz:[26,94], timbre:.72, idleWindow:[.05,.49], powerWindow:[.48,.95],
    }, engine, engine);
  },
} satisfies SoundRecipe;
