import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-demo-sheltered-wind.ts';
import detail from './_recordings/isolated-wind-leaf.ts';

export default {
  id: "wind-in-a-bare-orchard-crown-sustained-current-loop", name: "Wind in a bare orchard crown — sustained current", category: "Weather & Ambience",
  tags: ["wind", "field-recording", "open", "sustained current", "in", "a", "bare"], loopable: true, sustainMode: 'evolving', durationSec: 7.39,
  isolation:'isolated', components:['wind'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.61 } },
  ...sceneCredits(source, detail),
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: detail, singlePerformance: true, bodyHz: 5200, detailHz: 5900, spacing: 1.81, depth: .52, space: "open" }, "steady");
  },
} satisfies SoundRecipe;
