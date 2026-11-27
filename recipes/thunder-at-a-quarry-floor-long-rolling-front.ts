import type { SoundRecipe } from '../engine/types.ts';
import { thunderChannel } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-thunder-attack.ts';
import wash from './_recordings/isolated-storm-right.ts';
import detail from './_recordings/isolated-storm-body.ts';

const path = { space: "basin", cutoff: 2478, rolls: [0.015, 0.825, 1.95, 3.69, 5.73], decay: 3.21, width: 0.23 } as const;

export default {
  id: "thunder-at-a-quarry-floor-long-rolling-front", name: "Thunder at a quarry floor — long rolling front", category: "Weather & Ambience",
  tags: ["thunder", "lightning", "storm", "stereo", "basin"], loopable: false, durationSec: 9.72,
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
