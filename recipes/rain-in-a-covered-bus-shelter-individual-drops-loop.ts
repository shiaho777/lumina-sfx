import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-glazing.ts';

export default {
  id: "rain-in-a-covered-bus-shelter-individual-drops-loop", name: "Rain in a covered bus shelter — individual drops", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "screened", "individual drops", "in", "a", "covered"], loopable: true, durationSec: 6.98,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, discreteDrops: true, bodyHz: 3500, detailHz: 5200, spacing: 1.38, depth: .43, space: "screened" }, "scattered");
  },
} satisfies SoundRecipe;
