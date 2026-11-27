import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldHorseBreath from './_recordings/field-horse-breath.ts';
import bundleDryStalks from './_recordings/bundle-dry-stalks.ts';
import horseContactNicker from './_recordings/horse-contact-nicker.ts';

export default {
  id: 'horses-shifting-in-loose-straw-loop', name: "Horses shifting in loose straw loop", category: 'Animals',
  tags: ["horse", "breath", "hay", "stable", "loop"],
  loopable: true, durationSec: 4.5, mixRole: 'ambience', targetRmsDbfs: -28,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldHorseBreath, bundleDryStalks, horseContactNicker),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldHorseBreath, 0.27, 0.64, 0.76, 1, 10500, 0, 0.001, 0.022],
      [bundleDryStalks, 0.92, 0.47, 0.23, 1, 10500, 0, 0.001, 0.022],
      [horseContactNicker, 2.09, 1.04, 0.64, 1, 10500, 0, 0.001, 0.022],
      [bundleDryStalks, 3.41, 0.53, 0.21, 1, 10500, 0, 0.001, 0.022],
    ]);
  },
} satisfies SoundRecipe;
