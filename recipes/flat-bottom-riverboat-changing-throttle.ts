import { propulsion } from './_shared/propulsion.ts';
import load from './_recordings/isolated-motion-outboard-aeration.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-motion-flatboat-throttle.ts';

export default {
  id: "flat-bottom-riverboat-changing-throttle",
  name: "Flat-bottom riverboat changing throttle",
  category: "Water & Fire",
  tags: ["flat", "bottom", "riverboat", "changing", "throttle", "boat", "marine"],
  loopable: false,
  durationSec: 5.51,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  isolation:'isolated', components:['boat-engine'],
  ...sceneCredits(source, load),
  render(ctx, { params, seed }) {
    return propulsion(ctx, seed, params.intensity, .48, 'surge', {
      kind:'outboard', pulseHz:[22,117], timbre:.44, idleWindow:[.08,.94], powerWindow:[.10,.90],
    }, source, load);
  },
} satisfies SoundRecipe;
