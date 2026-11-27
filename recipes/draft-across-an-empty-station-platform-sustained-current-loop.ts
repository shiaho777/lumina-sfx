import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';

export default {
  soloQueries: ["wind", "steady wind"],
  id: "draft-across-an-empty-station-platform-sustained-current-loop", name: "Draft across an empty station platform — sustained current", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "passage", "sustained current", "draft", "across", "an", "empty"], loopable: true, sustainMode: 'evolving', durationSec: 7.35,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 3200, detailHz: 5800, spacing: 1.75, depth: .52, space: "passage" }, "steady");
  },
} satisfies SoundRecipe;
