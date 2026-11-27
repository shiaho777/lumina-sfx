import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-motion-outboard-cranking.ts';
import loaded from './_recordings/isolated-running-outboard.ts';

export default {
  isolation: 'isolated',
  id: 'fishing-skiff-tiller-motor-climb-onto-plane',
  name: 'Fishing skiff tiller motor climb onto plane',
  category: 'Vehicles & Engines',
  tags: ["boat", "outboard", "engine", "roll-on", "fishing", "skiff", "tiller", "motor", "climb", "onto", "plane"],
  loopable: false,
  durationSec: 2.84,
  targetRmsDbfs: -22,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'roll-on', {
      kind: 'outboard', exhaustBandHz: 460, pulseHz: [23, 135], timbre: 0.71, idleWindow: [0.46, 0.95], powerWindow: [0.22, 0.88],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
