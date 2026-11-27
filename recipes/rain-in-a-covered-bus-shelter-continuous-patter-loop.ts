import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-glazing.ts';

export default {
  id: "rain-in-a-covered-bus-shelter-continuous-patter-loop", name: "Rain in a covered bus shelter — continuous patter", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "screened", "continuous patter", "in", "a", "covered"], loopable: true, sustainMode: 'evolving', durationSec: 7.1,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 3500, detailHz: 5200, spacing: 1.38, depth: .43, space: "screened" }, "steady");
  },
} satisfies SoundRecipe;
