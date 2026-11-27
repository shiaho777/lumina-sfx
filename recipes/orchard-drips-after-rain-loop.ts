import { farmBed } from './_shared/farm-foley.ts';
import type { SoundRecipe } from '../engine/types.ts';

export default {
  isolation: 'isolated', components: ['water-drops'],
  id: "orchard-drips-after-rain-loop", name: "Orchard Leaves Dripping after Rain", category: "Weather & Ambience",
  tags: ["orchard", "rain", "leaf", "drip", "afternoon", "loop"],
  durationSec: 12.6, loopable: true, targetRmsDbfs: -32,
  params: { activity: { label: 'Activity', min: 0, max: 1, default: 0.42 } },
  render(ctx, { params }) {
    return farmBed(ctx, params.activity, { flow: 415, hiss: 1910, pace: .16, pulse: .81, drops: 3.8, ring: 1150 });
  },
} satisfies SoundRecipe;
