import { farmBed } from './_shared/farm-foley.ts';
import type { SoundRecipe } from '../engine/types.ts';

export default {
  isolation: 'isolated', components: ['water-drops'],
  id: "roof-runoff-barrel-loop", name: "Roof Runoff into a Barrel", category: "Water & Fire",
  tags: ["rain", "roof", "barrel", "runoff", "water", "loop"],
  durationSec: 11.8, loopable: true, targetRmsDbfs: -29,
  params: { activity: { label: 'Activity', min: 0, max: 1, default: 0.42 } },
  render(ctx, { params }) {
    return farmBed(ctx, params.activity, { flow: 790, hiss: 3160, pace: .37, pulse: 2.1, drops: 23, ring: 370 });
  },
} satisfies SoundRecipe;
