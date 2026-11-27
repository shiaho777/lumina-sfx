import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';
import detail from './_recordings/isolated-field-corn-rustle.ts';

export default {
  id: "wind-at-a-saltmarsh-boardwalk-sustained-current-loop", name: "Wind at a saltmarsh boardwalk — sustained current", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "open", "sustained current", "at", "a", "saltmarsh"], loopable: true, sustainMode: 'evolving', durationSec: 6.94,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source, detail),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: detail, singlePerformance: true, bodyHz: 5400, detailHz: 3770, spacing: 1.14, depth: .56, space: "open" }, "steady");
  },
} satisfies SoundRecipe;
