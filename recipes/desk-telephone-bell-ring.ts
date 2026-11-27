import type { SoundRecipe } from '../engine/types.ts';
import { mix, modal } from '../engine/dsp.ts';
import { renderRecording } from '../engine/recording.ts';
import clapper from './_recordings/isolated-small-clapper-strike.ts';

export default {
  id: 'desk-telephone-bell-ring', name: 'Mechanical desk telephone bell ringing',
  category: 'Props & Interactions', tags: ['phone', 'telephone', 'bell', 'mechanical', 'ring', 'desk', 'rotary', 'clapper', 'single', 'burst'],
  isolation: 'isolated', components: ['bell'], contains: ['one sustained mechanical ring and its decay'],
  perspective: 'dry room source', recording: clapper.credit,
  durationSec: 0.96, loopable: false, mixRole: 'foley', targetRmsDbfs: -25,
  params: { spring: { label: 'Clapper tension', min: 0, max: 1, default: 0.52 } },
  render(ctx, { params }) {
    const out = new Float32Array(ctx.frames);
    const hit = { ...ctx, frames: Math.ceil(0.22 * ctx.sampleRate) };
    // Two fixed gongs share one armature. Their overtones continue through the next strike.
    const gongs = [0, 1].map(side => {
      const contact = renderRecording(hit, clapper, {
        seed: side, speed: side ? 0.86 : 0.78, cutoffHz: 5300 + 750 * params.spring,
      });
      const body = modal(hit, 'metal', side ? 1374 : 1003, side ? 0.045 : 0.063);
      mix(contact, body, side ? 0.075 : 0.10);
      return contact;
    });
    const halfCycle = 1 / (31 + 6 * params.spring);
    let time = 0;
    for (let strike = 0; time < 0.73; strike++) {
      const side = strike % 2;
      const level = (side ? 0.81 : 1) * (0.94 + ctx.random() * 0.08);
      mix(out, gongs[side], level, Math.round(time * ctx.sampleRate));
      time += halfCycle * (strike < 2 ? 1.15 : 1) * (0.985 + ctx.random() * 0.03);
    }
    return out;
  },
} satisfies SoundRecipe;
