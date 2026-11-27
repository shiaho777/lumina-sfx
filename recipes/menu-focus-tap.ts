import type { SoundRecipe } from '../engine/types.ts';
import { interfaceFeedback } from './_shared/interface-feedback.ts';

export default {
  id: 'menu-focus-tap', name: 'Menu Focus Tap', category: 'Footsteps & UI',
  tags: ['menu', 'pointer', 'hover', 'select', 'focus', 'minimal', 'ui'],
  isolation: 'isolated',
  loopable: false, durationSec: 0.068, targetRmsDbfs: -35,
  params: { pressure: { label: 'Pressure', min: 0, max: 1, default: 0.55 } },
  render(ctx, { params }) {
    return interfaceFeedback(ctx, params.pressure, [
      [0, 652, 0.009, 0.9, 'felt'],
      [0.007, 1135, 0.0045, 0.31, 'felt'],
    ]);
  },
} satisfies SoundRecipe;
