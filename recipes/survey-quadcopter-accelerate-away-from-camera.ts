import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-quad-hover-blades.ts';
import loaded from './_recordings/isolated-quad-loaded-blades.ts';

export default {
  id: 'survey-quadcopter-accelerate-away-from-camera',
  name: 'Survey quadcopter accelerate away from camera',
  category: 'Aircraft',
  tags: ["drone", "rotor", "aircraft", "fan", "engine", "depart", "survey", "quadcopter", "accelerate", "away", "from", "camera"],
  perspective: 'authored pass-by perspective',
  isolation: 'isolated', components: ['electric-rotors'],
  loopable: false,
  durationSec: 2.69,
  targetRmsDbfs: -23,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'depart', {
      kind: 'fan', pulseHz: [105, 306], timbre: 0.9, idleWindow: [0.24, 0.86], powerWindow: [0.19, 0.91],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
