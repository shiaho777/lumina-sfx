import type { SoundRecipe } from '../engine/types.ts';
import { renderRecording } from '../engine/recording.ts';
import keys from './_recordings/isolated-keys-on-table.ts';

export default {
  id: 'keys-set-down-on-wood',
  name: 'Metal keys set down on a wooden counter',
  category: 'Props & Interactions',
  tags: ['keys', 'keyring', 'keychain', 'metal', 'set', 'put', 'down', 'place', 'table', 'wood', 'wooden', 'counter', 'settle'],
  components: ['keys landing on wood'],
  contains: ['keys meet the wooden tabletop and settle against each other'],
  perspective: 'close tabletop contact',
  markers: { contact: 0.015 },
  isolation: 'isolated',
  loopable: false,
  durationSec: 0.47,
  targetRmsDbfs: -28,
  mixRole: 'foley',
  recording: keys.credit,
  params: { force: { label: 'Placement force', min: 0, max: 1, default: 0.4 } },
  render(ctx, { seed, params }) {
    return renderRecording(ctx, keys, {
      seed,
      speed: 0.96 + 0.08 * params.force,
    });
  },
} satisfies SoundRecipe;
