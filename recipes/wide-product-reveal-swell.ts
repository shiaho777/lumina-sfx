import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-cloth-pass.ts';
import { screenAir } from './_shared/screen-foley.ts';

export default {
  id: "wide-product-reveal-swell",
  name: "Wide Product Reveal Swell",
  category: "Sci-Fi & UI",
  tags: ["wide", "product", "reveal", "swell", 'trailer', 'editorial', 'soft', 'air', 'untuned'],
  isolation: 'isolated', markers: { apex: 1.3688 },
  perspective: 'editorial transition', contains: ['one continuous air swell'],
  recording: texture.credit,
  loopable: false,
  durationSec: 2.32,
  targetRmsDbfs: -24,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "interface",
  render(ctx, { seed, params }) {
    return screenAir(ctx, seed, params.intensity, .59, 290, 3400, false, texture);
  },
} satisfies SoundRecipe;
