import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldGoatYoung from './_recordings/isolated-young-goat.ts';
import sheepBellJingle from './_recordings/sheep-bell-jingle.ts';
import pressPottingSoil from './_recordings/press-potting-soil.ts';

export default {
  id: 'goat-bell-swings-as-it-turns', name: "Goat bell swings as it turns", category: 'Animals',
  tags: ["goat", "bell", "turning", "movement"],
  loopable: false, durationSec: 1.212, mixRole: 'voice', targetRmsDbfs: -25,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldGoatYoung, sheepBellJingle, pressPottingSoil),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldGoatYoung, 0.0, 0.72, 0.89, 1, 10500, 0, 0.001, 0.022],
      [sheepBellJingle, 0.28, 0.78, 0.52, 1, 10500, 0, 0.001, 0.022],
      [pressPottingSoil, 0.52, 0.29, 0.19, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
