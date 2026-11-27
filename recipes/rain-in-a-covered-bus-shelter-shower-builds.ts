import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-glazing.ts';

export default {
  id: "rain-in-a-covered-bus-shelter-shower-builds", name: "Rain in a covered bus shelter — shower builds", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "screened", "shower builds", "in", "a", "covered"], loopable: false, durationSec: 4.8,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 3500, detailHz: 5200, spacing: 1.38, depth: .43, space: "screened" }, "surge");
  },
} satisfies SoundRecipe;
