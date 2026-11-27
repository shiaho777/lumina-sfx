import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-roof.ts';

export default {
  id: "raindrops-in-a-galvanized-feed-trough-downpour-recedes", name: "Raindrops in a galvanized feed trough — downpour recedes", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "open", "downpour recedes", "raindrops", "in", "a", "galvanized"], loopable: false, durationSec: 4.22,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 5200, detailHz: 7800, spacing: .47, depth: .56, space: "open" }, "retreat");
  },
} satisfies SoundRecipe;
