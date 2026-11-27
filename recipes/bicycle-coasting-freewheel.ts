import { mix, rng } from '../engine/dsp.ts';
import { renderRecording } from '../engine/recording.ts';
import type { RenderContext, SoundRecipe } from '../engine/types.ts';
import freehub from './_recordings/isolated-coasting-freehub.ts';

// Seconds just before distinct pawl strikes in each close-miked freewheel take.
// The recorded wheel slows on its stand. Keep each strike and its ring, then
// let the pictured wheel speed determine when the next tooth passes the pawl.
const toothStarts = [
  [0.004, 0.034, 0.063, 0.094, 0.123, 0.153, 0.184, 0.213, 0.243, 0.273, 0.302, 0.333,
    0.364, 0.395, 0.425, 0.458, 0.488],
  [2.949, 2.995, 3.042, 3.090, 3.135, 3.180, 3.224, 3.266, 3.309, 3.351, 3.396, 3.440],
];

function recordedTeeth(ctx: RenderContext) {
  const rate = ctx.sampleRate;
  const frames = Math.round(0.023 * rate);
  return toothStarts.flatMap((starts, take) => {
    const startSec = starts[0];
    const lastOffset = Math.round((starts[starts.length - 1] - startSec) * rate);
    const recording = renderRecording({ ...ctx, frames: lastOffset + frames }, freehub, {
      seed: take,
      startSec,
    });
    return starts.map(start => {
      const offset = Math.round((start - startSec) * rate);
      const tooth = recording.slice(offset, offset + frames);
      for (let i = 0; i < frames; i++) {
        tooth[i] *= Math.min(1, i / (0.0004 * rate), (frames - 1 - i) / (0.004 * rate));
      }
      return tooth;
    });
  });
}

export default {
  id: 'bicycle-coasting-freewheel',
  name: 'Coasting bicycle · freewheel pawls',
  category: 'Vehicles & Engines',
  tags: ['bicycle', 'bike', 'cycle', 'coasting', 'coast', 'freewheel', 'freehub', 'ratchet', 'pawls', 'ticking', 'rolling'],
  components: ['bicycle freewheel'],
  contains: ['freehub pawls ticking at a steady wheel speed while the pedals stay still'],
  perspective: 'close wheel hub',
  isolation: 'isolated',
  loopable: true,
  sustainMode: 'evolving',
  durationSec: 6.3,
  mixRole: 'vehicle',
  targetRmsDbfs: -27,
  recording: freehub.credit,
  params: { speed: { label: 'Coasting wheel speed', min: 0, max: 1, default: 0.45 } },
  render(ctx, { seed, params }) {
    const teeth = recordedTeeth(ctx);
    const draw = rng(seed);
    const firstTooth = Math.floor(draw() * teeth.length);
    const ticksPerSecond = 12 + 30 * params.speed;
    const loopTeeth = Math.max(1, Math.round((ctx.loopFrames ?? ctx.frames) * ticksPerSecond / ctx.sampleRate));
    const period = ctx.loopFrames ? ctx.loopFrames / loopTeeth : ctx.sampleRate / ticksPerSecond;
    const phase = draw() * period;
    const result = new Float32Array(ctx.frames);
    for (let tooth = -1; Math.round(phase + tooth * period) < result.length; tooth++) {
      // Render the same clock phase in the continuation used by the loop crossfade.
      const toothInLoop = (tooth + loopTeeth) % loopTeeth;
      const strike = teeth[(firstTooth + toothInLoop) % teeth.length];
      mix(result, strike, 1, Math.round(phase + tooth * period));
    }
    return result;
  },
} satisfies SoundRecipe;
