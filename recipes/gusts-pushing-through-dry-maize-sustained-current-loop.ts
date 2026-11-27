import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-field-corn-rustle.ts';
import wash from './_recordings/isolated-demo-sheltered-wind.ts';

export default {
  id: "gusts-pushing-through-dry-maize-sustained-current-loop", name: "Gusts pushing through dry maize — sustained current", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "open", "sustained current", "gusts", "pushing", "through", "dry"], loopable: true, sustainMode: 'evolving', durationSec: 7.11,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source, wash),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: wash, detail: source, singlePerformance: true, bodyHz: 5200, detailHz: 6900, spacing: 1.4, depth: .53, space: "open" }, "steady");
  },
} satisfies SoundRecipe;
