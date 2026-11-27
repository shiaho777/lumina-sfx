import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-foliage.ts';

export default {
  id: "rain-along-a-canvas-market-awning-continuous-patter-loop", name: "Rain along a canvas market awning — continuous patter", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "screened", "continuous patter", "along", "a", "canvas"], loopable: true, sustainMode: 'evolving', durationSec: 7.06,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 4900, detailHz: 6400, spacing: 1.33, depth: .46, space: "screened" }, "steady");
  },
} satisfies SoundRecipe;
