import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-foliage.ts';

export default {
  id: "rain-along-a-canvas-market-awning-shower-builds", name: "Rain along a canvas market awning — shower builds", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "screened", "shower builds", "along", "a", "canvas"], loopable: false, durationSec: 4.76,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 4900, detailHz: 6400, spacing: 1.33, depth: .46, space: "screened" }, "surge");
  },
} satisfies SoundRecipe;
