import type { SoundRecipe } from '../engine/types.ts';
import { cinematicCut } from './_shared/cinematic-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/atlas-firecracker.ts';
import wash from './_recordings/demo-fighter-rise.ts';
import detail from './_recordings/isolated-demo-sheltered-wind.ts';

export default {
  id: "arcade-rocket-open-air-departure", name: "Arcade rocket — open air departure", category: "Missiles",
  tags: ["flyby", "cinematic", "flight", "arcade", "rocket", "open", "field-foley"], loopable: false, durationSec: 1.94,
  mixRole: "impact", targetRmsDbfs: -21,
  params: { force: { label: "Force", min: 0, max: 1, default: 0.58 } },
  ...sceneCredits(source, wash, detail),
  render(ctx, { seed, params }) {
    return cinematicCut(ctx, seed, params.force, {
      kind: "pass", trajectory: "departure", space: "open", at: [0], color: 8500, mass: 0.76, edge: 0.65, scatter: 1, panDepth: 0.58,
    }, source, wash, detail);
  },
} satisfies SoundRecipe;
