import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-drain.ts';

export default {
  id: "rain-at-a-storm-drain-mouth-individual-drops-loop", name: "Rain at a storm drain mouth — individual drops", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "open", "individual drops", "at", "a", "storm"], loopable: true, durationSec: 6.56,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, discreteDrops: true, bodyHz: 3100, detailHz: 7300, spacing: .77, depth: .53, space: "open" }, "scattered");
  },
} satisfies SoundRecipe;
