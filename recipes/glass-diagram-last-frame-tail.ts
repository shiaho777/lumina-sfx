import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-response-microclick.ts';
import { biquad } from '../engine/dsp.ts';
import { seatedContact } from './_shared/screen-foley.ts';

export default {
  id: "glass-diagram-last-frame-tail",
  name: "Glass Diagram Last Frame Tail",
  category: "Sci-Fi & UI",
  tags: ["glass", "diagram", "last", "frame", "tail"],
  loopable: false,
  durationSec: 1.17,
  targetRmsDbfs: -29,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "interface",
  isolation: 'isolated', recording: texture.credit,
  render(ctx, { seed, params }) {
    const out=seatedContact(ctx,texture,seed,params.intensity,740,3950,.36);
    const glass=biquad('bandpass',1850+450*params.intensity,2.1,ctx.sampleRate);
    for(let i=0;i<out.length;i++) {
      const t=i/ctx.sampleRate;
      out[i]=out[i]*.45 + glass(ctx.random()*2-1)*.048*Math.exp(-t/.062);
    }
    return out;
  },
} satisfies SoundRecipe;
