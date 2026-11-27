import type { SoundRecipe } from '../engine/types.ts';
import { interfaceFeedback } from './_shared/interface-feedback.ts';

export default {
  id: 'menu-confirm-pluck', name: 'Menu Confirm Pluck', category: 'Footsteps & UI',
  tags: ['menu', 'select', 'enter', 'confirm', 'positive', 'button', 'ui'],
  isolation: 'isolated',
  loopable: false, durationSec: 0.21, targetRmsDbfs: -28,
  params: { pressure: { label: 'Pressure', min: 0, max: 1, default: 0.55 } },
  render(ctx, { params }) {
    return interfaceFeedback(ctx, params.pressure, [
      [0, 523.25, 0.026, 0.8, 'string'],
      [0.028, 783.99, 0.03, 0.94, 'wood'],
    ]);
  },
} satisfies SoundRecipe;
