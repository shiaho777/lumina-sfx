import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-bike-idle-core.ts';
import loaded from './_recordings/motorcycle-road-pass.ts';

export default {
  id: 'four-cylinder-sportbike-hard-climb-throttle-loop',
  name: 'Four-cylinder sportbike hard climb throttle loop',
  category: 'Vehicles & Engines',
  tags: ["vehicle", "piston", "engine", "load", "four", "cylinder", "sportbike", "hard", "climb", "throttle", "loop"],
  loopable: true,
  durationSec: 2.27,
  targetRmsDbfs: -21,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'load', {
      kind: 'piston', pulseHz: [52, 442], timbre: 0.96, idleWindow: [0.19, 0.65], powerWindow: [0.2, 0.84],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
