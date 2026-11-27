import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-demo-turbine-idle.ts';
import loaded from './_recordings/isolated-demo-fighter-rise.ts';

export default {
  isolation:'isolated', components:['jet-engine'],
  id: "jet-warm-idle-on-ramp-loop",
  name: "Jet Warm Idle on Ramp",
  category: "Aircraft",
  tags: ["jet", "warm", "idle", "ramp"],
  loopable: true,
  durationSec: 8.0,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  ...sceneCredits(idle, loaded),
  render(ctx, { params, seed }) {
    return propulsion(ctx, seed, params.intensity, .50, 'idle', {
      kind: 'jet', pulseHz: [174, 720], timbre: .83, idleWindow: [.12, .87], powerWindow: [.19, .78],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
