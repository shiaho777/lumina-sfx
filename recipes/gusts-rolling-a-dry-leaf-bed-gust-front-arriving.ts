import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-field-corn-rustle.ts';
import wash from './_recordings/isolated-demo-sheltered-wind.ts';
import detail from './_recordings/isolated-wind-leaf.ts';

export default {
  id: "gusts-rolling-a-dry-leaf-bed-gust-front-arriving", name: "Gusts rolling a dry leaf bed — gust front arriving", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "open", "gust front arriving", "gusts", "rolling", "a", "dry"], loopable: false, durationSec: 4.78,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source, wash, detail),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash, detail, singlePerformance: true, bodyHz: 5400, detailHz: 7450, spacing: 1.35, depth: .49, space: "open" }, "surge");
  },
} satisfies SoundRecipe;
