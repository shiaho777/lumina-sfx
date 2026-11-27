import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldBrookBed from './_recordings/field-brook-bed.ts';
import naturalRobin from './_recordings/isolated-robin-call.ts';

export default {
  id: 'robin-singing-over-a-brook-loop', name: "Robin singing over a brook loop", category: 'Animals',
  tags: ["robin", "songbird", "stream", "dawn", "loop"],
  loopable: true, durationSec: 4.5, mixRole: 'ambience', targetRmsDbfs: -29,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(fieldBrookBed, naturalRobin),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [fieldBrookBed, 0, 5.0, 0.26, 1, 6200, 2.0, 0.001, 0.015],
      [naturalRobin, 0.45, 1.85, 0.87, 1, 10500, 0, 0.001, 0.022],
      [naturalRobin, 3.4, 1.02, 0.46, 1, 10500, 0, 0.001, 0.022],
    ]);
  },
} satisfies SoundRecipe;
