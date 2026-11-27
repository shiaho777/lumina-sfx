import type { SoundRecipe } from '../engine/types.ts';
import { fieldWeather } from './_shared/weather-field.ts';
import { sceneCredits } from './_shared/material-scenes.ts';
import source from './_recordings/isolated-rain-roof.ts';

export default {
  id: "windblown-rain-on-a-loose-garage-door-downpour-recedes", name: "Windblown rain on a loose garage door — downpour recedes", category: "Weather & Ambience",
  tags: ["rain", "field-recording", "interior", "downpour recedes", "windblown", "on", "a"], loopable: false, durationSec: 4.78,
  soloQueries: ['garage door rain patter', 'rain on a loose metal door', 'rain patter on a loose garage door'],
  contains: ['rain patter on sheet metal', 'loose door rattle'],
  mixRole: "ambience", targetRmsDbfs: -25,
  params: { intensity: { label: "Intensity", min: 0, max: 1, default: 0.52 } },
  ...sceneCredits(source), isolation: 'isolated', components: ['rain'],
  render(ctx, { seed, params }) {
    return fieldWeather(ctx, seed, params.intensity, { base: source, wash: source, detail: source, singlePerformance: true, bodyHz: 4800, detailHz: 7100, spacing: 1.2, depth: .51, space: "interior" }, "retreat");
  },
} satisfies SoundRecipe;
