import type { SoundRecipe } from '../engine/types.ts';
import sheet from './_recordings/isolated-shelter-roof-patter.ts';
import { sustain } from './_shared/field-layers.ts';
import { biquad } from '../engine/dsp.ts';

export default {
  id: 'corrugated-metal-roof-rain-loop', name: 'Rain on a corrugated metal roof', category: 'Weather & Ambience',
  tags: ['rain', 'corrugated', 'metal', 'roof', 'shelter', 'sheet', 'patter', 'aluminium'],
  isolation: 'isolated', components: ['rain'], recording: sheet.credit,
  loopable: true, sustainMode: 'evolving', durationSec: 7.8, mixRole: 'ambience', targetRmsDbfs: -29,
  // Keep the fine attacks of nearby drops above the damped roof resonance.
  spectrum: [{ band: 'high', minShare: 0.05 }],
  params: { tension: {label: 'Sheet tension', min: 0, max: 1, default: 0.5} },
  render(ctx, {seed, params}) {
    // The recorded impacts drive the panel. A damped rib resonates beneath each drop.
    const dry = sustain(ctx, sheet, seed, 1, 12500);
    const rib = biquad('bandpass', 590 + 330 * params.tension, 1.3, ctx.sampleRate);
    const drop = biquad('highpass', 3800, 0.68, ctx.sampleRate);
    return dry.map(x => x * 0.97 + rib(x) * 0.15 + drop(x) * 0.2);
  },
} satisfies SoundRecipe;
