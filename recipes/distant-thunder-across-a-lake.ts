import { thunderPass } from './_shared/weather-textures.ts';
import { biquad } from '../engine/dsp.ts';
import type { SoundRecipe } from '../engine/types.ts';

export default {
  isolation:'isolated', components:['thunder'],
  id: "distant-thunder-across-a-lake",
  name: "Distant Thunder across a Lake",
  category: "Weather & Ambience",
  tags: ["distant", "thunder", "across", "lake", "ambience"],
  loopable: false,
  durationSec: 7.1,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  render(ctx, { params }) {
    const fog = biquad('lowpass', 845, 0.66, ctx.sampleRate);
    const bed = thunderPass(ctx, 0.86 - params.intensity * 0.30, false).map(fog);
    return bed;
  },
} satisfies SoundRecipe;
