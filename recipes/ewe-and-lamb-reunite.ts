import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldLambCall from './_recordings/isolated-lamb-call.ts';
import sheepBleat from './_recordings/isolated-sheep-voice.ts';

export default {
  id: 'ewe-and-lamb-reunite', name: "Ewe and lamb reunite", category: 'Animals',
  tags: ["sheep", "lamb", "bleat", "answer"],
  loopable: false, durationSec: 3.402, mixRole: 'voice', targetRmsDbfs: -23,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldLambCall, sheepBleat),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldLambCall, 0.0, 1.05, 0.94, 1, 10500, 0, 0.001, 0.022],
      [sheepBleat, 1.17, 1.21, 0.78, 1, 10500, 0, 0.001, 0.022],
      [fieldLambCall, 2.38, 0.87, 0.61, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
