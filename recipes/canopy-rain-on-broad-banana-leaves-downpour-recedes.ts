import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-foliage.ts';

export default {
  id: "canopy-rain-on-broad-banana-leaves-downpour-recedes", name: "Canopy rain on broad banana leaves — downpour recedes", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "open", "downpour recedes", "canopy", "on", "broad"], loopable: false, durationSec: 4.42,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 6200, detailHz: 8200, spacing: .73, depth: .51, space: "open" }, "retreat");
  },
} satisfies SoundRecipe;
