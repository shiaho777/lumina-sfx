import type { SoundRecipe } from '../engine/types.ts';
import water from './_recordings/isolated-water-lift.ts';
import { waterCrossing } from './_shared/water-crossing.ts';

export default {
  id: 'swimmer-breaks-into-air', name: "Swimmer breaks back into open air", category: 'Water & Fire',
  tags: ["swimmer", "breaks", "into", "air"], contains: ["waterline slosh", "surface breaks", "water drains"], perspective: 'crossing waterline',
  markers: {"surface": 0.2, "drain": 0.52}, loopable: false, durationSec: 2.2,
  mixRole: 'foley', targetRmsDbfs: -23,
  params: { force: { label: 'Gesture force', min: 0, max: 1, default: 0.5 } },
  isolation: 'isolated', recording: water.credit,
  render(ctx, { params }) {
    return waterCrossing(ctx, water, params.force, false);
  },
} satisfies SoundRecipe;
