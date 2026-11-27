import { renderRecording } from '../engine/recording.ts';
import type { SoundRecipe } from '../engine/types.ts';
import braking from './_recordings/isolated-tire-scrub.ts';

export default {
  id: 'wet-tire-contact-patch-loop', name: 'Wet tire sliding under load', category: 'Vehicles & Engines',
  tags: ['wet', 'tire', 'slip', 'skid', 'sustained'], contains: ['loaded tire rubbing wet pavement'],
  perspective: 'roadside exterior', markers: { scrub: 0 }, loopable: true, durationSec: 0.69,
  params: { pressure: { label: 'Tire pressure on road', min: 0, max: 1, default: 0.5 } },
  mixRole: 'vehicle', targetRmsDbfs: -26, recording: braking.credit,
  render(ctx, { seed, params }) {
    // Excerpt the sustained friction in the middle of the take. The braking tail belongs to the stop event.
    return renderRecording(ctx, braking, {
      seed, startSec: 0.62, speed: 0.94 + params.pressure * 0.10, cutoffHz: 5200 + params.pressure * 6200,
    });
  },
} satisfies SoundRecipe;
