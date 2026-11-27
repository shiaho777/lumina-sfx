import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-drain.ts';

export default {
  id: "rainwater-passing-a-blocked-downspout-downpour-recedes", name: "Rainwater passing a blocked downspout — downpour recedes", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "passage", "downpour recedes", "rainwater", "passing", "a", "blocked"], loopable: false, durationSec: 4.5,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 2400, detailHz: 6600, spacing: .83, depth: .62, space: "passage" }, "retreat");
  },
} satisfies SoundRecipe;
