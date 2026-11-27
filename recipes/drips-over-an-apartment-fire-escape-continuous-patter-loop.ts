import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-aluminium-roof-shower.ts';

export default {
  id: "drips-over-an-apartment-fire-escape-continuous-patter-loop", name: "Drips over an apartment fire escape — continuous patter", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "passage", "continuous patter", "drips", "over", "an", "apartment"], loopable: true, sustainMode: 'evolving', durationSec: 6.43,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 6650, detailHz: 5700, spacing: .39, depth: .41, space: "passage" }, "steady");
  },
} satisfies SoundRecipe;
