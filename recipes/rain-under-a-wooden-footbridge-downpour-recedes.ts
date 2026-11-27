import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-foliage.ts';

export default {
  id: "rain-under-a-wooden-footbridge-downpour-recedes", name: "Rain under a wooden footbridge — downpour recedes", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "screened", "downpour recedes", "under", "a", "wooden"], loopable: false, durationSec: 4.36,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 3350, detailHz: 5700, spacing: .65, depth: .49, space: "screened" }, "retreat");
  },
} satisfies SoundRecipe;
