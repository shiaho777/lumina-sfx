import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import demoJetPass from './_recordings/demo-jet-pass.ts';
import motionJetWaterApproach from './_recordings/motion-jet-water-approach.ts';
import demoFilmWind from './_recordings/isolated-demo-sheltered-wind.ts';
import demoJetTakeoff from './_recordings/demo-jet-takeoff.ts';
import motionJetWaterRetreat from './_recordings/motion-jet-water-retreat.ts';

export default {
  id: 'low-jet-downwash-churns-the-inlet', name: "Low Jet Downwash Churns the Inlet", category: 'Aircraft',
  tags: ["jet", "aircraft", "downwash", "flyover", "water", "inlet", "turbulence"],
  durationSec: 5.6, loopable: false, mixRole: 'vehicle', targetRmsDbfs: -13.5,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...performanceCredits(demoJetPass, motionJetWaterApproach, demoFilmWind, demoJetTakeoff, motionJetWaterRetreat),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.intensity, [
      [demoJetPass, 0, 1.45, 0.46, 0.94, 5200, 0.04, 0.38, 0.48],
      [motionJetWaterApproach, 0.18, 1.35, 0.42, 0.92, 4800, 0.05, 0.35, 0.48],
      [demoFilmWind, 0.65, 1.4, 0.38, 0.9, 2600, 0.06, 0.35, 0.5],
      [demoJetPass, 1.05, 1.35, 0.84, 1.06, 9800, 0.02, 0.2, 0.46],
      [demoJetTakeoff, 1.32, 1.65, 0.88, 0.78, 4600, 0.02, 0.24, 0.62],
      [motionJetWaterApproach, 1.42, 1.3, 0.76, 1.05, 8600, 0.08, 0.18, 0.46],
      [demoFilmWind, 1.78, 1.55, 0.72, 0.78, 1800, 0.04, 0.22, 0.62],
      [demoJetTakeoff, 2.35, 1.75, 0.76, 0.66, 2400, 0.08, 0.32, 0.78],
      [motionJetWaterRetreat, 2.42, 1.45, 0.82, 0.96, 7800, 0.04, 0.2, 0.58],
      [demoFilmWind, 2.95, 1.6, 0.54, 0.72, 1450, 0.12, 0.32, 0.75],
      [motionJetWaterRetreat, 3.45, 1.45, 0.58, 0.88, 5200, 0.12, 0.32, 0.68],
      [demoJetTakeoff, 3.65, 1.9, 0.44, 0.56, 1100, 0.16, 0.4, 1.05],
      [motionJetWaterRetreat, 4.35, 1.25, 0.3, 0.82, 3400, 0.18, 0.28, 0.72],
    ]);
  },
} satisfies SoundRecipe;
