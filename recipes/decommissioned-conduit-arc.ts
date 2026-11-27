import type { SoundRecipe } from '../engine/types.ts';
import contact from './_recordings/isolated-response-rocker.ts';
import { seatedContact } from './_shared/screen-foley.ts';
import { layer, biquad } from '../engine/dsp.ts';

export default {
  id: "decommissioned-conduit-arc",
  name: "Decommissioned Conduit Arc",
  category: "Sci-Fi & UI",
  tags: ["decommissioned", "conduit", "arc"],
  loopable: false,
  durationSec: 1.27,
  targetRmsDbfs: -25,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  isolation: 'isolated', recording: contact.credit,
  render(ctx, { seed, params }) {
    const field = new Float32Array(ctx.frames);
    const bite = biquad('bandpass', 1400 + params.intensity * 1150, .8, ctx.sampleRate);
    // The discharge sputters irregularly as stored charge drains from the conduit.
    let t = 0;
    for (let event = 0; event < 7; event++) {
      const length = .009 + ctx.random() * .038;
      const end = Math.min(ctx.frames, Math.round((t + length * 4) * ctx.sampleRate));
      const start = Math.round(t * ctx.sampleRate);
      for (let i = start; i < end; i++)
        field[i] += bite(ctx.random() * 2 - 1) * Math.exp(-(i-start)/(length*ctx.sampleRate)) / (1 + event * .4);
      t += length + .015 + ctx.random() * .098;
    }
    layer(ctx, field, 0, .07, part => seatedContact(part, contact, seed, params.intensity, 740, 3700, .28), .15);
    return field;
  },
} satisfies SoundRecipe;
