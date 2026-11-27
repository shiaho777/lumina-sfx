import type { SoundRecipe } from '../engine/types.ts';
import { renderRecording } from '../engine/recording.ts';
import diesel from './_recordings/isolated-van-engine-running.ts';
import asphalt from './_recordings/isolated-asphalt-tire-texture.ts';

export default {
  id: 'diesel-van-road-loop',
  name: 'Delivery van rolling on asphalt',
  category: 'Vehicles & Engines',
  tags: ['van', 'delivery', 'diesel', 'engine', 'rolling', 'tires', 'pavement', 'asphalt', 'road', 'steady'],
  contains: ['running diesel van engine', 'dry road tire noise'],
  closeMatches: [{ phrases: ['compact delivery van', 'compact van'], term: 'compact', note: 'The recording identifies a diesel van. Its dimensions are undocumented.' }],
  components: ['van engine', 'tire roll'],
  perspective: 'stationary exterior emitter',
  recording: diesel.credit,
  additionalRecordings: [asphalt.credit],
  isolation: 'isolated',
  loopable: true,
  durationSec: 2.1,
  targetRmsDbfs: -25,
  mixRole: 'vehicle',
  params: { speed: { label: 'Road speed', min: 0, max: 1, default: 0.43 } },
  render(ctx, { params }) {
    const engine = renderRecording(ctx, diesel, {
      speed: 0.92 + 0.15 * params.speed,
      cutoffHz: 3900 + 2500 * params.speed,
    });
    // The tire stem retains the measured broadband asphalt color. The original
    // car's engine and its passing geometry are absent from the texture.
    const tires = renderRecording(ctx, asphalt, {
      speed: 0.9 + 0.24 * params.speed,
      startSec: ctx.random() * 0.75,
    });
    const roadGain = 0.19 + 0.14 * params.speed;
    for (let i = 0; i < engine.length; i++) engine[i] += roadGain * tires[i];
    return engine;
  },
} satisfies SoundRecipe;
