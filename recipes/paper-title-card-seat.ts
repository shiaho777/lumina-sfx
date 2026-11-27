import type { SoundRecipe } from '../engine/types.ts';
import { renderRecording } from '../engine/recording.ts';
import paperboard from './_recordings/isolated-paperboard-seat.ts';

export default {
  id: 'paper-title-card-seat', name: 'Paper title card landing', category: 'Footsteps & UI',
  tags: ['title', 'card', 'land', 'settle', 'restrained', 'paper', 'contact', 'editorial', 'dry'],
  isolation: 'isolated', mixRole: 'interface', perspective: 'close dry contact',
  contains: ['one short paperboard contact'], recording: paperboard.credit,
  loopable: false, durationSec: 0.068, targetRmsDbfs: -32,
  markers: { contact: 0, settle: 0 }, params: { weight: { label: 'Card weight', min: 0, max: 1, default: 0.38 } },
  render(ctx, { seed, params }) {
    // Start at the board's seating contact, after the earlier flap movement.
    const card = renderRecording(ctx, paperboard, {
      seed,
      startSec: 0.024,
      speed: 1.02 - 0.08 * params.weight,
      cutoffHz: 3500 + 1300 * params.weight,
    });
    const onset = 0.0015 * ctx.sampleRate;
    const decay = (0.017 + 0.009 * params.weight) * ctx.sampleRate;
    return card.map((x, i) => x * Math.min(1, i / onset) * Math.exp(-i / decay));
  },
} satisfies SoundRecipe;
