import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-bike-idle-core.ts';
import loaded from './_recordings/motorcycle-road-pass.ts';

export default {
  id: 'four-cylinder-sportbike-two-throttle-blips',
  name: 'Four-cylinder sportbike two throttle blips',
  category: 'Vehicles & Engines',
  tags: ["vehicle", "piston", "engine", "surge", "four", "cylinder", "sportbike", "two", "throttle", "blips"],
  loopable: false,
  durationSec: 2.12,
  targetRmsDbfs: -23,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'surge', {
      kind: 'piston', pulseHz: [52, 442], timbre: 0.96, idleWindow: [0.19, 0.65], powerWindow: [0.2, 0.84],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
