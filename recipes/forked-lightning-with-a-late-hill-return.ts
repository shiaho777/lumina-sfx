import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import atlasFirecracker from './_recordings/isolated-atlas-firecracker.ts';
import atlasThunderLeft from './_recordings/isolated-thunder-attack.ts';
import atlasThunderRight from './_recordings/isolated-storm-right.ts';
import atlasThunderRoll from './_recordings/isolated-storm-body.ts';

export default {
  isolation:'isolated', components:['thunder'],
  id: 'forked-lightning-with-a-late-hill-return', name: "Forked Lightning with a Late Hill Return", category: 'Weather & Ambience',
  tags: ["lightning", "thunder", "storm", "hills", "echo", "late-return", "weather"],
  durationSec: 6.4, loopable: false, mixRole: 'impact', targetRmsDbfs: -12.5,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...performanceCredits(atlasFirecracker, atlasThunderLeft, atlasThunderRight, atlasThunderRoll ),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.intensity, [
      [atlasFirecracker, 0, 0.28, 0.82, 1.24, 14500, 0.0, 0.002, 0.14],
      [atlasFirecracker, 0.065, 0.3, 0.9, 1.06, 13200, 0.05, 0.002, 0.16],
      [atlasFirecracker, 0.14, 0.34, 0.76, 0.94, 11800, 0.1, 0.004, 0.18],
      [atlasThunderLeft, 0.16, 1.45, 0.95, 0.88, 6800, 0.0, 0.008, 0.75],
      [atlasThunderRight, 0.34, 1.55, 0.84, 0.82, 5400, 0.02, 0.014, 0.82],
      [atlasThunderRoll, 0.42, 1.95, 0.82, 0.62, 1400, 0.04, 0.08, 1.05],
      [atlasThunderRoll, 1.75, 1.4, 0.32, 0.56, 520, 0.18, 0.3, 0.78],
      [atlasThunderRoll, 3.12, 2.45, 0.92, 0.46, 380, 0.02, 0.42, 1.25],
      [atlasThunderLeft, 3.38, 2.25, 0.78, 0.5, 440, 0.08, 0.38, 1.15],
      [atlasThunderRight, 3.88, 2.2, 0.7, 0.48, 360, 0.1, 0.44, 1.25],
      [atlasThunderRoll, 4.45, 1.95, 0.52, 0.42, 260, 0.14, 0.45, 1.15],
    ]);
  },
} satisfies SoundRecipe;
