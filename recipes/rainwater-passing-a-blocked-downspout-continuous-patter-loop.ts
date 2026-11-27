import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-drain.ts';

export default {
  id: "rainwater-passing-a-blocked-downspout-continuous-patter-loop", name: "Rainwater passing a blocked downspout — continuous patter", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "passage", "continuous patter", "rainwater", "passing", "a", "blocked"], loopable: true, sustainMode: 'evolving', durationSec: 6.72,
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 2400, detailHz: 6600, spacing: .83, depth: .62, space: "passage" }, "steady");
  },
} satisfies SoundRecipe;
