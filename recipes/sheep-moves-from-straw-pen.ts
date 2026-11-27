import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import bundleDryStalks from './_recordings/bundle-dry-stalks.ts';
import sheepBleat from './_recordings/isolated-sheep-voice.ts';
import pressPottingSoil from './_recordings/press-potting-soil.ts';
import sheepBellJingle from './_recordings/sheep-bell-jingle.ts';

export default {
  id: 'sheep-moves-from-straw-pen', name: "Sheep moves from straw pen", category: 'Animals',
  tags: ["sheep", "hoof", "bleat", "straw"],
  loopable: false, durationSec: 1.724, mixRole: 'voice', targetRmsDbfs: -25,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(bundleDryStalks, sheepBleat, pressPottingSoil, sheepBellJingle),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [bundleDryStalks, 0.0, 0.52, 0.29, 1, 10500, 0, 0.001, 0.022],
      [sheepBleat, 0.16, 1.21, 0.98, 1, 10500, 0, 0.001, 0.022],
      [pressPottingSoil, 0.55, 0.31, 0.21, 1, 10500, 0, 0.001, 0.022],
      [sheepBellJingle, 0.89, 0.72, 0.25, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.024, 0.064], send: 0.125, dampingHz: 3300 });
  },
} satisfies SoundRecipe;
