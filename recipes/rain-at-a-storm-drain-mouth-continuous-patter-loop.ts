import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-drain.ts';

export default {
  id: "rain-at-a-storm-drain-mouth-continuous-patter-loop", name: "Rain at a storm drain mouth — continuous patter", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "open", "continuous patter", "at", "a", "storm"], loopable: true, sustainMode: 'evolving', durationSec: 6.68,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 3100, detailHz: 7300, spacing: .77, depth: .53, space: "open" }, "steady");
  },
} satisfies SoundRecipe;
