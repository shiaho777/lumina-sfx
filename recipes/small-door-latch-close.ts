import type { SoundRecipe } from '../engine/types.ts';
import { renderRecording } from '../engine/recording.ts';
import latch from './_recordings/isolated-shutting-latch.ts';

export default {
  id: 'small-door-latch-close',
  name: 'Small door latch clicking shut',
  category: 'Props & Interactions',
  tags: ['small', 'door', 'latch', 'closing', 'close', 'shut', 'catch', 'fastener', 'single', 'click'],
  components: ['door latch'],
  contains: ['one latch clicking into its catch'],
  perspective: 'close mechanical contact',
  markers: { contact: 0.005 },
  isolation: 'isolated',
  loopable: false,
  durationSec: 0.103,
  targetRmsDbfs: -26,
  mixRole: 'foley',
  recording: latch.credit,
  params: { force: { label: 'Latch force', min: 0, max: 1, default: 0.45 } },
  render(ctx, { seed, params }) {
    return renderRecording(ctx, latch, {
      seed,
      speed: 0.94 + 0.12 * params.force,
      cutoffHz: 5100 + 3900 * params.force,
    });
  },
} satisfies SoundRecipe;
