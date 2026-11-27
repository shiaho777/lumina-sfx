import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-roof.ts';

export default {
  id: "drips-over-an-apartment-fire-escape-individual-drops-loop", name: "Drips over an apartment fire escape — individual drops", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "passage", "individual drops", "drips", "over", "an", "apartment"], loopable: true, durationSec: 6.31,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, discreteDrops: true, bodyHz: 6650, detailHz: 5700, spacing: .39, depth: .41, space: "passage" }, "scattered");
  },
} satisfies SoundRecipe;
