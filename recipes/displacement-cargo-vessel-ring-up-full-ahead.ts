import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-motion-marine-engine.ts';
import loaded from './_recordings/isolated-response-diesel-loaded.ts';

export default {
  isolation: 'isolated',
  id: 'displacement-cargo-vessel-ring-up-full-ahead',
  name: 'Displacement cargo vessel ring up full ahead',
  category: 'Vehicles & Engines',
  tags: ["boat", "diesel", "engine", "roll-on", "displacement", "cargo", "vessel", "ring", "up", "full", "ahead"],
  loopable: false,
  durationSec: 2.11,
  targetRmsDbfs: -22,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'roll-on', {
      kind: 'diesel', pulseHz: [11, 51], timbre: 0.33, idleWindow: [0.09, 0.9], powerWindow: [0.14, 0.9],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
