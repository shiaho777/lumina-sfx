import type { SoundRecipe } from '../engine/types.ts';
import { renderRecording } from '../engine/recording.ts';
import bounce from './_recordings/isolated-hardwood-basketball.ts';

export default {
  id: 'basketball-hardwood-single-dribble',
  name: 'Basketball bounce on hardwood',
  category: 'Impacts',
  tags: ['basketball', 'ball', 'inflated', 'wood', 'hardwood', 'court', 'floor', 'bounce', 'single', 'dribble', 'gym'],
  contains: ['inflated basketball striking a wooden gym floor'],
  closeMatches: [{ phrases: ['leather basketball', 'leather ball'], term: 'leather', note: 'The basketball and wooden court are recorded together. The ball cover is undocumented.' }],
  components: ['basketball bounce'],
  perspective: 'indoor court',
  markers: { impact: 0.004 },
  isolation: 'isolated',
  loopable: false,
  durationSec: 0.72,
  targetRmsDbfs: -29.9,
  mixRole: 'foley',
  recording: bounce.credit,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  render(ctx, { seed, params }) {
    return renderRecording(ctx, bounce, { seed, speed: 0.96 + 0.08 * params.intensity });
  },
} satisfies SoundRecipe;
