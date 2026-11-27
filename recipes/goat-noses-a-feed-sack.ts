import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import burlapFeedSackOpen from './_recordings/burlap-feed-sack-open.ts';
import fieldGoatYoung from './_recordings/isolated-young-goat.ts';
import bundleDryStalks from './_recordings/bundle-dry-stalks.ts';

export default {
  id: 'goat-noses-a-feed-sack', name: "Goat noses a feed sack", category: 'Animals',
  tags: ["goat", "feeding", "curiosity", "kid"],
  loopable: false, durationSec: 1.304, mixRole: 'voice', targetRmsDbfs: -26,
  params: { presence: { label: 'Presence', min: 0, max: 1, default: 0.52 } },
  ...performanceCredits(burlapFeedSackOpen, fieldGoatYoung, bundleDryStalks),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.presence, [
      [burlapFeedSackOpen, 0.0, 0.51, 0.43, 1, 10500, 0, 0.001, 0.022],
      [fieldGoatYoung, 0.4, 0.74, 0.88, 1, 10500, 0, 0.001, 0.022],
      [bundleDryStalks, 0.92, 0.27, 0.2, 1, 10500, 0, 0.001, 0.022],
    ], { taps: [0.024, 0.064], send: 0.125, dampingHz: 3300 });
  },
} satisfies SoundRecipe;
