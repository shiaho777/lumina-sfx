import type { SoundRecipe } from '../engine/types.ts';

export default {
  id: 'soft-touch-acknowledgement',
  name: 'Soft electronic touch acknowledgement',
  category: 'Footsteps & UI',
  tags: ['touch', 'touchscreen', 'phone', 'ui', 'feedback', 'electronic', 'acknowledgement', 'quiet', 'single'],
  isolation: 'isolated',
  perspective: 'local interface',
  contains: ['one rounded electronic pulse'],
  soloQueries: ['quiet electronic acknowledgement', 'phone feedback tick', 'soft electronic touch feedback'],
  loopable: false,
  durationSec: 0.072,
  targetRmsDbfs: -32,
  mixRole: 'interface',
  markers: { contact: 0 },
  params: { softness: { label: 'Roundness', min: 0, max: 1, default: 0.63 } },
  render(ctx, { params }) {
    const output = new Float32Array(ctx.frames);
    const frequency = 720 - 150 * params.softness;
    const attack = 0.0025 + 0.0025 * params.softness;
    let phase = 0;
    for (let i = 0; i < output.length; i++) {
      const seconds = i / ctx.sampleRate;
      const rise = Math.sin(0.5 * Math.PI * Math.min(1, seconds / attack)) ** 2;
      const decay = Math.exp(-seconds / (0.012 + 0.004 * params.softness));
      phase += 2 * Math.PI * frequency * (1 + 0.013 * Math.exp(-seconds / 0.007)) / ctx.sampleRate;
      const body = Math.sin(phase) + 0.15 * Math.exp(-seconds / 0.009) * Math.sin(2 * phase);
      output[i] = rise * decay * body;
    }
    return output;
  },
} satisfies SoundRecipe;
