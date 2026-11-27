import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-cloth-pass.ts';
import contact from './_recordings/isolated-key-office.ts';
import { screenAir, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "clean-title-reveal-with-soft-hit",
  name: "Clean Title Reveal with Soft Hit",
  category: "Sci-Fi & UI",
  tags: ["clean", "title", "reveal", "soft", "hit", 'editorial', 'title card', 'landing', 'trailer', 'dry'],
  isolation: 'isolated', markers: { apex: 0.532, settle: 0.53 },
  perspective: 'editorial transition', contains: ['air swell', 'soft landing contact'],
  recording: texture.credit, additionalRecordings: [contact.credit],
  loopable: false,
  durationSec: 1.52,
  targetRmsDbfs: -23,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "interface",
  render(ctx, { seed, params }) {
    const amount = params.intensity;
    const out = screenAir(ctx, seed, amount, .35, 325, 3900, false, texture);
    layer(ctx, out, .53, .16, part => seatedContact(part, contact, seed, amount, 260, 2200, .46), .26);
    return out;
  },
} satisfies SoundRecipe;
