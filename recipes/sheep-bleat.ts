import { renderRecording } from '../engine/recording.ts';
import type { SoundRecipe } from '../engine/types.ts';
import recording from './_recordings/isolated-sheep-voice.ts';

export default {
  isolation: 'isolated',
  id: "sheep-bleat", name: "Sheep Bleat", category: 'Animals',
  tags: ["sheep","lamb","bleat","farm"], loopable: false, durationSec: 1.52,
  params: { tremor: { label: "Tremor", min: 0, max: 1, default: 0.58 } },
  targetRmsDbfs: -21,
  recording: recording.credit,
  render(ctx, { seed, params }) {
    return renderRecording(ctx, recording, { seed, speed: 0.986 + params.tremor * 0.032, cutoffHz: 11300 });
  },
} satisfies SoundRecipe;
