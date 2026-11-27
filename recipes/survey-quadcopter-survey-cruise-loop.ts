import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-quad-hover-blades.ts';
import loaded from './_recordings/isolated-quad-loaded-blades.ts';

export default {
  id: 'survey-quadcopter-survey-cruise-loop',
  name: 'Survey quadcopter survey cruise loop',
  category: 'Aircraft',
  tags: ["small", "electric", "motor", "steady", "hover", "drone", "rotor", "aircraft", "fan", "engine", "cruise", "survey", "quadcopter", "loop"],
  isolation: 'isolated', components: ['electric-rotors'],
  perspective: 'stationary exterior emitter', sustainMode: 'evolving',
  loopable: true,
  durationSec: 3.02,
  targetRmsDbfs: -24,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'cruise', {
      kind: 'fan', pulseHz: [105, 306], timbre: 0.9, idleWindow: [0.24, 0.86], powerWindow: [0.19, 0.91],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
