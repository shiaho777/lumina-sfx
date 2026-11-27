import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import atlasBubbles from './_recordings/atlas-bubbles.ts';
import atlasThunderRoll from './_recordings/atlas-thunder-roll.ts';
import demoFilmWind from './_recordings/isolated-demo-sheltered-wind.ts';
import wateringGardenSoak from './_recordings/watering-garden-soak.ts';
import wateringCanRose from './_recordings/watering-can-rose.ts';

export default {
  id: 'geyser-lifts-then-rains-back', name: "Geyser Lifts Then Rains Back", category: 'Water & Fire',
  tags: ["geyser", "eruption", "steam", "water", "rain", "geothermal", "splash"],
  durationSec: 6.2, loopable: false, mixRole: 'foley', targetRmsDbfs: -14.5,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...performanceCredits(atlasBubbles, atlasThunderRoll, demoFilmWind, wateringGardenSoak, wateringCanRose),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.intensity, [
      [atlasBubbles, 0, 1.35, 0.46, 0.78, 2200, 0.04, 0.26, 0.46],
      [atlasThunderRoll, 0.12, 1.8, 0.56, 0.54, 320, 0.04, 0.48, 0.65],
      [atlasBubbles, 0.68, 1.25, 0.66, 0.92, 3800, 0.08, 0.22, 0.42],
      [demoFilmWind, 1.05, 1.35, 0.64, 0.98, 5200, 0.04, 0.26, 0.45],
      [wateringGardenSoak, 1.22, 1.3, 0.84, 1.04, 8800, 0.02, 0.18, 0.46],
      [atlasThunderRoll, 1.35, 1.9, 0.72, 0.5, 360, 0.08, 0.24, 0.88],
      [demoFilmWind, 1.92, 1.3, 0.74, 1.08, 7600, 0.08, 0.2, 0.52],
      [wateringGardenSoak, 2.15, 1.35, 0.8, 0.98, 7800, 0.08, 0.22, 0.54],
      [wateringGardenSoak, 3.05, 1.3, 0.54, 0.9, 6200, 0.14, 0.26, 0.58],
      [wateringCanRose, 3.25, 1.25, 0.66, 1.06, 9800, 0.02, 0.22, 0.48],
      [wateringCanRose, 3.92, 1.28, 0.72, 0.98, 8600, 0.08, 0.24, 0.52],
      [atlasBubbles, 4.15, 1.4, 0.34, 0.74, 2000, 0.14, 0.34, 0.68],
      [wateringCanRose, 4.68, 1.32, 0.5, 0.92, 7200, 0.12, 0.28, 0.64],
      [wateringCanRose, 5.2, 1.0, 0.26, 0.88, 5400, 0.18, 0.22, 0.58],
    ]);
  },
} satisfies SoundRecipe;
