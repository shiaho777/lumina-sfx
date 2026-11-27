import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-roof.ts';

export default {
  id: "drips-over-an-apartment-fire-escape-shower-builds", name: "Drips over an apartment fire escape — shower builds", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "passage", "shower builds", "drips", "over", "an", "apartment"], loopable: false, durationSec: 4.04,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 6650, detailHz: 5700, spacing: .39, depth: .41, space: "passage" }, "surge");
  },
} satisfies SoundRecipe;
