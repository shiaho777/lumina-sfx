import type { SoundRecipe } from '../engine/types.ts';
import tip from './_recordings/isolated-drawing-pen-tip.ts';
import { renderRecording } from '../engine/recording.ts';
import { biquad } from '../engine/dsp.ts';

export default {
  id: 'stylus-tip-on-tablet-glass',
  name: 'Polymer pen tip on tablet glass',
  category: 'Footsteps & UI',
  tags: ['stylus', 'pen', 'nib', 'tip', 'tablet', 'glass', 'hardware', 'single', 'tap', 'contact', 'close'],
  mixRole: 'foley', recording: tip.credit,
  isolation: 'isolated',
  loopable: false,
  durationSec: 0.054,
  targetRmsDbfs: -30,
  perspective: 'close dry contact',
  contains: ['one polymer nib tap on tablet glass'],
  markers: { contact: 0 },
  params: { pressure: { label: 'Nib pressure', min: 0, max: 1, default: 0.46 } },
  render(ctx, { seed, params }) {
    // Recorded tablet contact supplies the nib attack. A short panel mode colors the surface.
    const dry = renderRecording(ctx, tip, { seed, speed: 0.98 + 0.045 * params.pressure,
      cutoffHz: 8000 + 3500 * params.pressure });
    const panel = biquad('bandpass', 1190, 2, ctx.sampleRate);
    return dry.map(x => x + 0.18 * panel(x));
  },
} satisfies SoundRecipe;
