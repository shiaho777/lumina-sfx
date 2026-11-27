import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import naturalRobin from './_recordings/isolated-robin-call.ts';
import fieldBirdFlutter from './_recordings/field-bird-flutter.ts';
import dryVineBrush from './_recordings/dry-vine-brush.ts';

export default {
  id: 'robin-sings-then-changes-branch', name: "Robin sings then changes branch", category: 'Animals',
  tags: ["robin", "songbird", "flight", "perch"],
  loopable: false, durationSec: 2.551, mixRole: 'voice', targetRmsDbfs: -27,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(naturalRobin, fieldBirdFlutter, dryVineBrush),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [naturalRobin, 0.0, 2.06, 0.96, 1, 10500, 0, 0.001, 0.022],
      [fieldBirdFlutter, 1.89, 0.47, 0.36, 1, 10500, 0, 0.001, 0.022],
      [dryVineBrush, 2.12, 0.22, 0.15, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.073, 0.141], send: 0.13, dampingHz: 2100 });
  },
} satisfies SoundRecipe;
