import type { SoundRecipe } from '../engine/types.ts';
import { renderRecording } from '../engine/recording.ts';
import finger from './_recordings/isolated-finger-on-phone.ts';

export default {
  id: 'fingertip-on-display-glass',
  name: 'Close fingertip contact on display glass',
  category: 'Footsteps & UI',
  tags: [
    'finger',
    'fingertip',
    'glass',
    'display',
    'touchscreen',
    'hardware',
    'close',
    'single',
    'soft',
    'contact',
    'tap',
  ],
  mixRole: 'foley',
  recording: finger.credit,
  isolation: 'isolated',
  loopable: false,
  durationSec: 0.062,
  targetRmsDbfs: -34,
  perspective: 'close dry contact',
  contains: ['one damped finger-pad contact on display glass'],
  markers: { contact: 0 },
  params: { pressure: { label: 'Finger pressure', min: 0, max: 1, default: 0.52 } },
  render(ctx, { seed, params }) {
    return renderRecording(ctx, finger, {
      seed,
      speed: 0.96 + 0.08 * params.pressure,
      cutoffHz: 4500 + 2500 * params.pressure,
    });
  },
} satisfies SoundRecipe;
