import type { SoundRecipe } from '../engine/types.ts';
import { perform, performanceCredits } from './_shared/field-performance.ts';
import fieldWetRoad from './_recordings/field-wet-road.ts';
import milestoneSmallwater from './_recordings/milestone-smallwater.ts';
import carWetAsphaltPass from './_recordings/car-wet-asphalt-pass.ts';
import carTireSkidLaunch from './_recordings/car-tire-skid-launch.ts';
import carWetBrakingStop from './_recordings/isolated-tire-scrub.ts';

export default {
  id: 'tire-floats-then-finds-wet-asphalt', name: "Tire Floats Then Finds Wet Asphalt", category: 'Vehicles & Engines',
  tags: ["tire", "hydroplane", "aquaplane", "wet-asphalt", "skid", "car", "traction"],
  durationSec: 3.8, loopable: false, mixRole: 'vehicle', targetRmsDbfs: -15.0,
  params: { intensity: { label: 'Intensity', min: 0, max: 1, default: 0.55 } },
  ...performanceCredits(fieldWetRoad, milestoneSmallwater, carWetAsphaltPass, carTireSkidLaunch, carWetBrakingStop),
  render(ctx, { seed, params }) {
    return perform(ctx, seed, params.intensity, [
      [fieldWetRoad, 0, 1.3, 0.62, 1.06, 8600, 0.04, 0.14, 0.42],
      [milestoneSmallwater, 0.14, 1.05, 0.48, 1.08, 7200, 0.05, 0.18, 0.4],
      [carWetAsphaltPass, 0.28, 1.25, 0.44, 1.04, 5400, 0.06, 0.24, 0.45],
      [fieldWetRoad, 0.88, 1.1, 0.66, 1.12, 9200, 0.12, 0.18, 0.42],
      [milestoneSmallwater, 1.05, 0.85, 0.44, 1.0, 6000, 0.14, 0.14, 0.36],
      [carTireSkidLaunch, 1.52, 0.52, 0.72, 1.08, 6400, 0.04, 0.03, 0.22],
      [carTireSkidLaunch, 1.78, 0.58, 0.58, 0.94, 4800, 0.12, 0.05, 0.28],
      [carWetBrakingStop, 1.92, 1.25, 0.78, 0.92, 3400, 0.02, 0.08, 0.52],
      [carWetAsphaltPass, 2.15, 1.3, 0.7, 0.88, 3800, 0.1, 0.18, 0.55],
      [fieldWetRoad, 2.55, 1.25, 0.42, 0.86, 4200, 0.16, 0.24, 0.68],
    ]);
  },
} satisfies SoundRecipe;
