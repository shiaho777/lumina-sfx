import type { SoundRecipe } from '../engine/types.ts';
import { snippet } from './_shared/field-layers.ts';
import cloth from './_recordings/isolated-cloth-pass.ts';
import { biquad } from '../engine/dsp.ts';

export default {
  id: "quiet-interview-split-view-slide",
  name: "Quiet Interview Split View Slide",
  category: "Sci-Fi & UI",
  tags: ["quiet", "interview", "split", "view", "slide"],
  loopable: false,
  durationSec: 1.01,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "interface",
  isolation: 'isolated', recording: cloth.credit,
  render(ctx, { seed, params }) {
    const out = new Float32Array(ctx.frames);
    const brush = snippet(ctx, cloth, seed, .19, 1.02 + .13*params.intensity, 2450);
    const band = biquad('highpass', 580, .65, ctx.sampleRate);
    for (let i=0;i<Math.min(brush.length,out.length);i++)
      out[i]=band(brush[i])*Math.sin(Math.PI*i/brush.length)**2;
    return out;
  },
} satisfies SoundRecipe;
