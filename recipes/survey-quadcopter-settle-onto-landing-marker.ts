import type { SoundRecipe } from '../engine/types.ts';
import { propulsion } from './_shared/propulsion.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import idle from './_recordings/isolated-quad-hover-blades.ts';
import loaded from './_recordings/isolated-quad-loaded-blades.ts';

export default {
  id: 'survey-quadcopter-settle-onto-landing-marker',
  name: 'Survey quadcopter settle onto landing marker',
  category: 'Aircraft',
  tags: ["drone", "rotor", "aircraft", "fan", "engine", "settle", "survey", "quadcopter", "onto", "landing", "marker"],
  isolation: 'isolated', components: ['electric-rotors'],
  loopable: false,
  durationSec: 2.4,
  targetRmsDbfs: -25,
  mixRole: 'vehicle',
  params: {
    rpm: { label: 'Normalized shaft speed', min: 0, max: 1, default: .5 },
    intensity: { label: 'Power demand', min: 0, max: 1, default: .55 },
  },
  ...sceneCredits(idle, loaded),
  render(ctx, { seed, params }) {
    return propulsion(ctx, seed, params.intensity, params.rpm, 'settle', {
      kind: 'fan', pulseHz: [105, 306], timbre: 0.9, idleWindow: [0.24, 0.86], powerWindow: [0.19, 0.91],
    }, idle, loaded);
  },
} satisfies SoundRecipe;
