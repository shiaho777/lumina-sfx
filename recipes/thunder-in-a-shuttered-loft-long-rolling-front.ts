import type { SoundRecipe } from '../engine/types.ts';
import { thunderChannel } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-thunder-attack.ts';
import wash from './_recordings/isolated-storm-right.ts';
import detail from './_recordings/isolated-storm-body.ts';

const path = { space: "interior", cutoff: 651, rolls: [0.008, 0.451, 1.066, 2.017, 3.132], decay: 3.21, width: 0.055 } as const;

export default {
  id: "thunder-in-a-shuttered-loft-long-rolling-front", name: "Thunder in a shuttered loft — long rolling front", category: "Weather & Ambience",
  tags: ["thunder", "lightning", "storm", "stereo", "interior"], loopable: false, durationSec: 7.12,
  isolation:'isolated', components:['thunder'],
  mixRole: "impact", targetRmsDbfs: -20,
  params: { distance: { label: "Distance", min: 0, max: 1, default: 0.39 } },
  ...sceneCredits(source, wash, detail),
  renderStereo(ctx, { seed, params }) {
    return [
      thunderChannel(ctx, seed, params.distance, path, source, detail, -1),
      thunderChannel(ctx, seed, params.distance, path, wash, detail, 1),
    ];
  },
  render(ctx, { seed, params }) {
    const left = thunderChannel(ctx, seed, params.distance, path, source, detail, -1);
    const right = thunderChannel(ctx, seed, params.distance, path, wash, detail, 1);
    return left.map((v, i) => .5 * (v + right[i]));
  },
} satisfies SoundRecipe;
