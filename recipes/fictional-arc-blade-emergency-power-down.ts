import type { SoundRecipe } from '../engine/types.ts';
import texture from './_recordings/isolated-tire-scrub.ts';
import contact from './_recordings/isolated-response-rocker.ts';
import { shapedPass, seatedContact } from './_shared/screen-foley.ts';
import { layer } from '../engine/dsp.ts';

export default {
  id: "fictional-arc-blade-emergency-power-down",
  name: "Fictional arc blade emergency power down",
  category: "Weapons",
  tags: ["fictional", "arc", "blade", "emergency", "power", "down"],
  loopable: false,
  durationSec: 1.2,
  targetRmsDbfs: -25.5,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "vehicle",
  isolation: 'isolated', recording: texture.credit, additionalRecordings: [contact.credit],
  render(ctx, { seed, params }) {
    const field = shapedPass(ctx, texture, seed, params.intensity, 0.36, 1750, 0.85);
    layer(ctx, field, 0, .12, part => seatedContact(part, contact, seed, params.intensity, 420, 2625, .41), 0.45);
    return field;
  },
} satisfies SoundRecipe;
