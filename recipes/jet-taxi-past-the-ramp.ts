import { propulsion } from './_shared/propulsion.ts';
import idle from './_recordings/isolated-demo-turbine-idle.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-fighter-rise.ts';

export default {
  id: "jet-taxi-past-the-ramp",
  name: "Jet Taxi Past the Ramp",
  category: "Aircraft",
  tags: ["jet", "taxi", "past", "ramp"],
  loopable: false,
  durationSec: 6.6,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  isolation:'isolated', components:['jet-engine'],
  ...sceneCredits(idle, source),
  render(ctx, { params, seed }) {
    const engine = propulsion(ctx, seed, params.intensity, .34, 'cruise', {
      kind:'jet', pulseHz:[153,620], timbre:.77, idleWindow:[.09,.9], powerWindow:[.17,.83],
    }, idle, source);
    return engine.map((x,i) => {
      const along = 2.4 * (i / engine.length - .43);
      return x / (1 + 4.1 * along * along);
    });
  },
} satisfies SoundRecipe;
