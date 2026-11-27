import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-roof.ts';

export default {
  id: "drips-over-an-apartment-fire-escape-downpour-recedes", name: "Drips over an apartment fire escape — downpour recedes", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "passage", "downpour recedes", "drips", "over", "an", "apartment"], loopable: false, durationSec: 4.16,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 6650, detailHz: 5700, spacing: .39, depth: .41, space: "passage" }, "retreat");
  },
} satisfies SoundRecipe;
