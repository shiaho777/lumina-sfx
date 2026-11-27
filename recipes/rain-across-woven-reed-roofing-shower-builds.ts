import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-foliage.ts';

export default {
  id: "rain-across-woven-reed-roofing-shower-builds", name: "Rain across woven reed roofing — shower builds", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "interior", "shower builds", "across", "woven", "reed"], loopable: false, durationSec: 4.23,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.72 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 4700, detailHz: 7150, spacing: .64, depth: .52, space: "interior" }, "surge");
  },
} satisfies SoundRecipe;
