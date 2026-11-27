import type { SoundRecipe } from '../engine/types.ts';
import { thunderChannel } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-thunder-attack.ts';
import wash from './_recordings/isolated-storm-right.ts';
import detail from './_recordings/isolated-storm-body.ts';

const path = { space: "basin", cutoff: 1600, rolls: [0.006, 0.54, 1.48, 2.8, 4.11], decay: 3.05, width: 0.22 } as const;

export default {
  id: "distant-rolling-thunder", name: "Distant Rolling Thunder", category: "Weather & Ambience",
  tags: ["thunder", "lightning", "storm", "stereo", "basin"], loopable: false, durationSec: 7.8,
  isolation:'isolated', components:['thunder'],
  mixRole: "impact", targetRmsDbfs: -20,
  params: { distance: { label: "Distance", min: 0, max: 1, default: 0.66 } },
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
