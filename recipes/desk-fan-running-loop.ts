import type { SoundRecipe } from '../engine/types.ts';
import { renderRecording } from '../engine/recording.ts';
import fan from './_recordings/isolated-desk-fan-air.ts';

export default {
  id: 'desk-fan-running-loop',
  name: 'Table fan running',
  category: 'Props & Interactions',
  tags: ['desk', 'table', 'fan', 'electric', 'air', 'blades', 'motor', 'steady', 'appliance'],
  contains: ['small electric fan motor and moving air'],
  components: ['desk fan'],
  perspective: 'close appliance',
  recording: fan.credit,
  isolation: 'isolated',
  loopable: true,
  durationSec: 5.8,
  targetRmsDbfs: -30,
  mixRole: 'ambience',
  params: { speed: { label: 'Fan speed', min: 0, max: 1, default: 0.36 } },
  render(ctx, { seed, params }) {
    return renderRecording(ctx, fan, {
      seed,
      startSec: 0.1 + 0.25 * ctx.random(),
      speed: 0.91 + 0.19 * params.speed,
    });
  },
} satisfies SoundRecipe;
