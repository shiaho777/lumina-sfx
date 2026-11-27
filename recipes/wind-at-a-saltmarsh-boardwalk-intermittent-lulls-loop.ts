import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';
import detail from './_recordings/isolated-field-corn-rustle.ts';

export default {
  id: "wind-at-a-saltmarsh-boardwalk-intermittent-lulls-loop", name: "Wind at a saltmarsh boardwalk — intermittent lulls", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "open", "intermittent lulls", "at", "a", "saltmarsh"], loopable: true, durationSec: 6.82,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  ...sceneCredits(source, detail),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: detail, singlePerformance: true, bodyHz: 4150, detailHz: 6100, spacing: 1.14, depth: .56, space: "open" }, "scattered");
  },
} satisfies SoundRecipe;
