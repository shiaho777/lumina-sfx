import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/motion-ducati-start.ts';
import loaded from './_recordings/isolated-bike-idle-core.ts';

export default {
  id: 'twin-cylinder-road-bike-two-throttle-blips',
  name: 'Twin-cylinder road bike two throttle blips',
  category: 'Vehicles & Engines',
  tags: ["vehicle", "piston", "engine", "surge", "twin", "cylinder", "road", "bike", "two", "throttle", "blips"],
  loopable: false,
  durationSec: 2.09,
  targetRmsDbfs: -23,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'surge', {
      kind: 'piston', pulseHz: [22, 179], timbre: 0.79, idleWindow: [0.45, 0.94], powerWindow: [0.13, 0.92],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
