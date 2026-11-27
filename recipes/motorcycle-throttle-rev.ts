import { renderRecording } from '../engine/recording.ts';
import type { SoundRecipe } from '../engine/types.ts';
import recording from './_recordings/response-trail-bike-surge.ts';

export default {
  id: 'motorcycle-throttle-rev', name: 'Motorcycle Throttle Rev', category: 'Vehicles & Engines',
  tags: ['motorcycle', 'bike', 'engine', 'rev', 'throttle'], loopable: false, durationSec: 3.83,
  params: { pace: { label: 'Pace', min: 0, max: 1, default: 0.5 } },
  targetRmsDbfs: -21,
  recording: recording.credit,
  render(ctx, { seed, params }) {
    return renderRecording(ctx, recording, { seed, speed: 1 + (params.pace - 0.5) * 0.05 });
  },
} satisfies SoundRecipe;
