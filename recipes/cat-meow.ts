import { renderRecording } from '../engine/recording.ts';
import type { SoundRecipe } from '../engine/types.ts';
import recording from './_recordings/isolated-cat-call.ts';

export default {
  id: "cat-meow", name: "Cat Meow", category: 'Animals',
  tags: ["cat","meow","pet","call"], loopable: false, durationSec: 1.34,
  params: { size: { label: "Size", min: 0, max: 1, default: 0.54 } },
  targetRmsDbfs: -23,
  isolation: 'isolated', components: ['cat-call'],
  recording: recording.credit,
  render(ctx, { seed, params }) {
    return renderRecording(ctx, recording, { seed, speed: 1.018 - params.size * 0.040, cutoffHz: 12200 });
  },
} satisfies SoundRecipe;
