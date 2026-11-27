import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';

export default {
  id: "wind-pushing-through-a-narrow-rock-slot-wind-dying-away", name: "Wind pushing through a narrow rock slot — wind dying away", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "basin", "wind dying away", "pushing", "through", "a"], loopable: false, durationSec: 5.15,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  ...sceneCredits(source),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 2600, detailHz: 5200, spacing: 1.68, depth: .75, space: "basin" }, "retreat");
  },
} satisfies SoundRecipe;
