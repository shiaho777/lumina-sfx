import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-rail-bend.ts';
import contact from './_recordings/isolated-response-rocker.ts';
import { shapedPass, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "energy-shield-overload-collapse",
  name: "Energy shield overload collapse",
  category: "Weapons",
  tags: ["energy", "shield", "overload", "collapse"],
  loopable: false,
  durationSec: 1.67,
  targetRmsDbfs: -22.5,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "impact",
  isolation: 'isolated', recording: texture.credit, additionalRecordings: [contact.credit],
  render(ctx, { seed, params }) {
    const field = shapedPass(ctx, texture, seed, params.intensity, 0.28, 2100, 0.91);
    layer(ctx, field, 0, .12, part => seatedContact(part, contact, seed, params.intensity, 504, 3150, .41), 0.65);
    return field;
  },
} satisfies SoundRecipe;
