import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-motion-marine-engine.ts';
import loaded from './_recordings/isolated-motion-flatboat-throttle.ts';

export default {
  isolation: 'isolated',
  id: 'harbor-launch-inboard-channel-cruise-loop',
  name: 'Harbor launch inboard channel cruise loop',
  category: 'Vehicles & Engines',
  tags: ["boat", "outboard", "engine", "cruise", "harbor", "launch", "inboard", "channel", "loop"],
  loopable: true, sustainMode: 'evolving',
  durationSec: 3.85,
  targetRmsDbfs: -24,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'cruise', {
      kind: 'outboard', pulseHz: [30, 150], timbre: 0.43, idleWindow: [0.18, 0.84], powerWindow: [0.13, 0.82],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
