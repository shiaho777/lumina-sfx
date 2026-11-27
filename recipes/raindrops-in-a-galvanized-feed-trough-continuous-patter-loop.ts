import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-roof.ts';

export default {
  id: "raindrops-in-a-galvanized-feed-trough-continuous-patter-loop", name: "Raindrops in a galvanized feed trough — continuous patter", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "open", "continuous patter", "raindrops", "in", "a", "galvanized"], loopable: true, sustainMode: 'evolving', durationSec: 6.48,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 5200, detailHz: 7800, spacing: .47, depth: .56, space: "open" }, "steady");
  },
} satisfies SoundRecipe;
