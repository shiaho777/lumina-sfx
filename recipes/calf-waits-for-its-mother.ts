import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldCalfContact from './_recordings/isolated-barn-call.ts';
import cowMoo from './_recordings/field-farm-cow.ts';

export default {
  id: 'calf-waits-for-its-mother', name: "Calf waits for its mother", category: 'Animals',
  tags: ["cow", "calf", "mother", "respond"],
  loopable: false, durationSec: 3.932, mixRole: 'voice', targetRmsDbfs: -24,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldCalfContact, cowMoo),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldCalfContact, 0.0, 1.32, 1.0, 1.14, 2500, 0, 0.001, 0.022],
      [cowMoo, 1.99, 1.35, 0.43, 0.96, 2700.0, 0, 0.001, 0.022],
    ], { taps: [0.042, 0.102], send: 0.055, dampingHz: 2600 });
  },
} satisfies SoundRecipe;
