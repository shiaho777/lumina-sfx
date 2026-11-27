import type { SoundRecipe } from '../engine/types.ts';
import { beeps } from './_shared/alerts.ts';

export default {
  id: "phone-ring-bell", name: "Phone Ring · Electronic Bell Cadence", category: "Footsteps & UI",
  tags: ["phone","ringtone","bell","retro"], loopable: false, durationSec: 2.1,
  params: { ring: { label: "Ring", min: 0, max: 1, default: 0.7 } },
  targetRmsDbfs: -22,
  render(ctx, { params }) {
    return beeps(ctx, [[0, 1040, 0.20, 1], [0.24, 1058, 0.18, 0.84], [1.04, 1040, 0.20, 0.88], [1.29, 1054, 0.16, 0.77]], params.ring, 'bell');
  },
} satisfies SoundRecipe;
