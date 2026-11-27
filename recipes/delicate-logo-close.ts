import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-cloth-pass.ts';
import contact from './_recordings/isolated-response-button.ts';
import { screenAir, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "delicate-logo-close",
  name: "Delicate Logo Close",
  category: "Sci-Fi & UI",
  tags: ["delicate", "logo", "close", 'editorial', 'trailer', 'end card', 'settle'],
  isolation: 'isolated', markers: { apex: 0.299, settle: 0.32 },
  perspective: 'editorial transition', contains: ['short receding air', 'soft final contact'],
  recording: texture.credit, additionalRecordings: [contact.credit],
  loopable: false,
  durationSec: 1.15,
  targetRmsDbfs: -28,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "interface",
  render(ctx, { seed, params }) {
    const amount = params.intensity;
    const out = screenAir(ctx, seed, amount, .26, 475, 3150, true, texture);
    layer(ctx, out, .32, .10, part => seatedContact(part, contact, seed, amount, 375, 2400, .46), .12);
    return out;
  },
} satisfies SoundRecipe;
