import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import sheepBellJingle from './_recordings/sheep-bell-jingle.ts';
import sheepBleat from './_recordings/isolated-sheep-voice.ts';

export default {
  id: 'ewe-shaking-a-neck-bell', name: "Ewe shaking a neck bell", category: 'Animals',
  tags: ["sheep", "grazing", "neck", "bell"],
  loopable: false, durationSec: 1.842, mixRole: 'voice', targetRmsDbfs: -25,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(sheepBellJingle, sheepBleat),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [sheepBellJingle, 0.0, 0.93, 0.69, 1, 10500, 0, 0.001, 0.022],
      [sheepBleat, 0.37, 1.15, 0.86, 1, 10500, 0, 0.001, 0.022],
      [sheepBellJingle, 1.12, 0.57, 0.2, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
