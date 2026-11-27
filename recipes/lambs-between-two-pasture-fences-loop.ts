import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldLambCall from './_recordings/isolated-lamb-call.ts';
import sheepBleat from './_recordings/isolated-sheep-voice.ts';

export default {
  isolation: 'isolated',
  id: 'lambs-between-two-pasture-fences-loop', name: "Lambs between two pasture fences loop", category: 'Animals',
  tags: ["sheep", "lamb", "spring", "pasture", "loop"],
  loopable: true, durationSec: 4.5, mixRole: 'ambience', targetRmsDbfs: -28,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldLambCall, sheepBleat),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldLambCall, 0.20, 0.87, 0.82, 0.96, 6800, 0, 0.001, 0.022],
      [sheepBleat, 1.97, .91, .52, 1.04, 5600, 0, 0.001, 0.022],
      [fieldLambCall, 3.58, .65, .38, 1.025, 6100, 0, 0.001, 0.022],
    ]);
  },
} satisfies SoundRecipe;
