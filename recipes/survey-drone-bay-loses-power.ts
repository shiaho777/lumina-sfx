import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-motion-marine-engine.ts';
import contact from './_recordings/isolated-response-rocker.ts';
import { shapedPass, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "survey-drone-bay-loses-power",
  name: "Survey Drone Bay Loses Power",
  category: "Sci-Fi & UI",
  tags: ["survey", "drone", "bay", "loses", "power"],
  loopable: false,
  durationSec: 1.21,
  targetRmsDbfs: -26,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "interface",
  isolation: 'isolated', recording: texture.credit, additionalRecordings: [contact.credit],
  render(ctx, { seed, params }) {
    const field = shapedPass(ctx, texture, seed, params.intensity, 0.07, 1120, 0.82);
    layer(ctx, field, .69, .12, part => seatedContact(part, contact, seed, params.intensity, 228, 1425, .41), 0.2);
    return field;
  },
} satisfies SoundRecipe;
