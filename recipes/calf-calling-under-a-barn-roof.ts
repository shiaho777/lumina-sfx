import { renderRecording } from '../engine/recording.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-barn-call.ts';

export default {
  id: "calf-calling-under-a-barn-roof",
  name: "Calf Calling under a Barn Roof",
  category: "Animals",
  tags: ["calf", "calling", "under", "barn", "roof", "livestock"],
  loopable: false,
  durationSec: 1.66,
  targetRmsDbfs: -23,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  recording: source.credit,
  render(ctx, { params, seed }) {
    return renderRecording(ctx,source,{seed,speed:1.12+.09*params.intensity,cutoffHz:2650});
  },
} satisfies SoundRecipe;
