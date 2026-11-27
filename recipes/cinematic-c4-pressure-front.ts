import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import atlasFirecracker from './_recordings/atlas-firecracker.ts';
import atlasThunderRoll from './_recordings/atlas-thunder-roll.ts';
import atlasThunderLeft from './_recordings/atlas-thunder-left.ts';
import rockPileImpact from './_recordings/rock-pile-impact.ts';
import air from './_recordings/isolated-demo-sheltered-wind.ts';

export default {
  id: 'cinematic-c4-pressure-front', name: "Cinematic C4 Pressure Front", category: 'Impacts',
  tags: ["blast", "pressure-front", "shockwave", "cinematic", "sub", "theatrical", "impact", "explosion"],
  durationSec: 4.4, loopable: false, mixRole: 'impact', targetRmsDbfs: -10.0,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...performanceCredits(atlasFirecracker, atlasThunderRoll, atlasThunderLeft, rockPileImpact, air),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.intensity, [
      [atlasFirecracker, 0, 0.24, 0.92, 1.04, 13800, 0.0, 0.002, 0.14],
      [atlasThunderRoll, 0.01, 1.95, 0.98, 0.4, 220, 0.0, 0.01, 1.1],
      [atlasThunderLeft, 0.018, 1.35, 0.94, 0.76, 4200, 0.0, 0.008, 0.75],
      [rockPileImpact, 0.045, 0.95, 0.84, 0.64, 1800, 0.0, 0.01, 0.52],
      [air, 0.12, 1.45, 0.78, 0.72, 2200, 0.02, 0.08, 0.65],
      [atlasThunderRoll, 0.78, 2.05, 0.8, 0.46, 290, 0.08, 0.24, 1.15],
      [rockPileImpact, 0.88, 1.05, 0.52, 0.88, 4400, 0.08, 0.08, 0.55],
      [air, 1.18, 1.5, 0.5, 0.68, 1400, 0.1, 0.28, 0.78],
      [rockPileImpact, 1.72, 0.98, 0.32, 1.02, 5200, 0.16, 0.14, 0.54],
      [atlasThunderLeft, 1.85, 1.85, 0.48, 0.5, 420, 0.14, 0.36, 1.05],
      [atlasThunderRoll, 2.35, 2.05, 0.44, 0.42, 240, 0.16, 0.4, 1.25],
    ]);
  },
} satisfies SoundRecipe;
