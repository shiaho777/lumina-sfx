import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-bike-idle-core.ts';
import loaded from './_recordings/motorcycle-road-pass.ts';

export default {
  id: 'four-cylinder-sportbike-roll-on-through-a-bend',
  name: 'Four-cylinder sportbike roll on through a bend',
  category: 'Vehicles & Engines',
  tags: ["vehicle", "piston", "engine", "roll-on", "four", "cylinder", "sportbike", "roll", "on", "through", "a", "bend"],
  loopable: false,
  durationSec: 1.94,
  targetRmsDbfs: -22,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'roll-on', {
      kind: 'piston', pulseHz: [52, 442], timbre: 0.96, idleWindow: [0.19, 0.65], powerWindow: [0.2, 0.84],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
