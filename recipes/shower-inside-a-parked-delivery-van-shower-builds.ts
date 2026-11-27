import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-glazing.ts';

export default {
  id: "shower-inside-a-parked-delivery-van-shower-builds", name: "Shower inside a parked delivery van — shower builds", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "screened", "shower builds", "shower", "inside", "a", "parked"], loopable: false, durationSec: 4.83,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 2200, detailHz: 4500, spacing: 1.42, depth: .41, space: "screened" }, "surge");
  },
} satisfies SoundRecipe;
