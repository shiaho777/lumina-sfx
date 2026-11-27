import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldFarmCow from './_recordings/field-farm-cow.ts';
import paddockGateSwing from './_recordings/paddock-gate-swing.ts';
import fieldCalfContact from './_recordings/isolated-barn-call.ts';

export default {
  id: 'cow-calls-over-a-closing-rail', name: "Cow calls over a closing rail", category: 'Animals',
  tags: ["cow", "cattle", "fence", "gate"],
  loopable: false, durationSec: 3.324, mixRole: 'voice', targetRmsDbfs: -22,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldFarmCow, paddockGateSwing, fieldCalfContact),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldFarmCow, 0.0, 1.22, 0.96, 1, 10500, 0, 0.001, 0.022],
      [paddockGateSwing, 0.8, 1.01, 0.23, 1, 10500, 0, 0.001, 0.022],
      [fieldCalfContact, 1.76, 1.45, 0.32, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.024, 0.064], send: 0.125, dampingHz: 3300 });
  },
} satisfies SoundRecipe;
