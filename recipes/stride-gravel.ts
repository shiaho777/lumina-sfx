import { strideContact } from './_shared/stride-contact.ts';
import contact from './_recordings/natural-gravel.ts';
import grit from './_recordings/natural-gravel-drag.ts';

export default {
  ...strideContact('gravel', ['shoe', 'boot', 'stones', 'grit', 'pebbles'], contact, -25, 0.48, {
    release: { clip: grit, startSec: 0.075, gain: 0.58, wetGain: 0.24, cutoffHz: 7000 },
  }),
  isolation: 'isolated' as const, components: ['footstep'],
};
