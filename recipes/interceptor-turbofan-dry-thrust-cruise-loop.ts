import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-demo-turbine-idle.ts';
import loaded from './_recordings/isolated-demo-fighter-rise.ts';

export default {
  isolation: 'isolated',
  components: ['jet-engine'],
  id: 'interceptor-turbofan-dry-thrust-cruise-loop',
  name: 'Interceptor turbofan dry thrust cruise loop',
  category: 'Aircraft',
  tags: ["aircraft", "jet", "engine", "cruise", "interceptor", "turbofan", "dry", "thrust", "loop"],
  loopable: true, sustainMode: 'evolving',
  durationSec: 4.67,
  targetRmsDbfs: -24,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'cruise', {
      kind: 'jet', pulseHz: [180, 760], timbre: 0.91, idleWindow: [0.23, 0.93], powerWindow: [0.22, 0.91],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
