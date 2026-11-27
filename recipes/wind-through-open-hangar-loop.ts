import { sustain, roomReturns } from './_shared/field-layers.ts';
import type { SoundRecipe } from '../engine/types.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';

export default {
  id: "wind-through-open-hangar-loop",
  name: "Wind through Open Hangar",
  category: "Weather & Ambience",
  tags: ["wind", "open", "hangar", "ambience"],
  loopable: true,
  durationSec: 10.0,
  targetRmsDbfs: -32,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  mixRole: "ambience",
  recording: source.credit, isolation:'isolated', components:['wind'],
  render(ctx, { params, seed }) {
    const air = sustain(ctx, source, seed, .89 + .13 * params.intensity, 2500 + 1900 * params.intensity);
    return roomReturns(ctx, air, 'interior');
  },
} satisfies SoundRecipe;
