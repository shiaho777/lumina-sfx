import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';
import detail from './_recordings/isolated-wind-fabric.ts';

export default {
  id: "wind-against-a-sail-locker-hatch-intermittent-lulls-loop", name: "Wind against a sail locker hatch — intermittent lulls", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "interior", "intermittent lulls", "against", "a", "sail"], loopable: true, durationSec: 7.28,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.23 } },
  ...sceneCredits(source, detail),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: detail, singlePerformance: true, bodyHz: 1900, detailHz: 4900, spacing: 1.83, depth: .46, space: "interior" }, "scattered");
  },
} satisfies SoundRecipe;
