import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/motion-ducati-start.ts';
import loaded from './_recordings/isolated-bike-idle-core.ts';

export default {
  id: 'twin-cylinder-road-bike-helmet-muffled-ride-loop',
  name: 'Twin-cylinder road bike helmet muffled ride loop',
  category: 'Vehicles & Engines',
  tags: ["vehicle", "piston", "engine", "cabin", "twin", "cylinder", "road", "bike", "helmet", "muffled", "ride", "loop"],
  loopable: true,
  durationSec: 2.41,
  targetRmsDbfs: -28,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'cabin', {
      kind: 'piston', pulseHz: [22, 179], timbre: 0.79, idleWindow: [0.45, 0.94], powerWindow: [0.13, 0.92],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
