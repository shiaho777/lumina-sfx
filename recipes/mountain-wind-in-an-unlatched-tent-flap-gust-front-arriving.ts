import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';
import wash from './_recordings/isolated-wind-fabric.ts';

export default {
  id: "mountain-wind-in-an-unlatched-tent-flap-gust-front-arriving", name: "Mountain wind in an unlatched tent flap — gust front arriving", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "screened", "gust front arriving", "mountain", "in", "an"], loopable: false, durationSec: 4.76,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source, wash),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: wash, detail: wash, singlePerformance: true, bodyHz: 2300, detailHz: 4900, spacing: 1.33, depth: .59, space: "screened" }, "surge");
  },
} satisfies SoundRecipe;
