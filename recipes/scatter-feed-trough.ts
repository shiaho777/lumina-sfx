import grain from './_recordings/plant-large-seeds.ts';
import { renderRecording } from '../engine/recording.ts';
import { biquad } from '../engine/dsp.ts';
import type { SoundRecipe } from '../engine/types.ts';

export default {
  id: "scatter-feed-trough", name: "Grain Scatter into a Feed Trough", category: "Farming",
  tags: ["grain", "feed", "trough", "scatter", "animal", "feeding"],
  durationSec: .69, loopable: false, targetRmsDbfs: -25,
  params: { force: { label: 'Force', min: 0, max: 1, default: 0.55 } },
  recording: grain.credit,
  render(ctx, { seed, params }) {
    const out = renderRecording(ctx, grain, { seed, speed: .84 + params.force * .29, cutoffHz: 4300 + params.force * 2200 });
    const trough = biquad('bandpass', 315, 1.2, ctx.sampleRate);
    for(let i=0;i<out.length;i++) out[i] += .35 * trough(out[i]);
    return out;
  },
} satisfies SoundRecipe;
