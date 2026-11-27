import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-rail-bend.ts';
import contact from './_recordings/isolated-response-rocker.ts';
import { shapedPass, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "clipped-energy-shot-in-a-tunnel",
  name: "Clipped Energy Shot in a Tunnel",
  category: "Impacts",
  tags: ["clipped", "energy", "shot", "tunnel"],
  loopable: false,
  durationSec: 1.29,
  targetRmsDbfs: -22,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  isolation: 'isolated', recording: texture.credit, additionalRecordings: [contact.credit],
  render(ctx, { seed, params }) {
    const field = shapedPass(ctx, texture, seed, params.intensity, 0.06, 1700, 1.12);
    layer(ctx, field, 0, .12, part => seatedContact(part, contact, seed, params.intensity, 408, 2550, .41), 0.88);
    return field;
  },
} satisfies SoundRecipe;
