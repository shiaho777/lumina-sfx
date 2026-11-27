import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-drain.ts';

export default {
  id: "rain-at-a-storm-drain-mouth-shower-builds", name: "Rain at a storm drain mouth — shower builds", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "open", "shower builds", "at", "a", "storm"], loopable: false, durationSec: 4.33,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 3100, detailHz: 7300, spacing: .77, depth: .53, space: "open" }, "surge");
  },
} satisfies SoundRecipe;
