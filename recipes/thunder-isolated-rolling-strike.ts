import { biquad, noise } from '../engine/dsp.ts';
import { renderRecording } from '../engine/recording.ts';
import type { SoundRecipe } from '../engine/types.ts';
import attack from './_recordings/isolated-thunder-attack.ts';
import { profile } from './_shared/thunder-profile.ts';

export default {
  soloQueries: ["thunder", "lightning", "rolling thunder", "thunderclap"],
  id: 'thunder-isolated-rolling-strike',
  name: 'Thunder · isolated rolling strike',
  category: 'Weather & Ambience',
  tags: ['lightning', 'thunder', 'strike', 'rumble', 'weather'],
  components: ['thunder'],
  isolation: 'isolated',
  recording: attack.credit,
  additionalRecordings: [profile.credit],
  mixRole: 'impact',
  loopable: false,
  durationSec: 5.7,
  targetRmsDbfs: -20,
  params: { force: { label: 'Discharge strength', min: 0, max: 1, default: 0.63 } },
  render(ctx, { params, seed }) {
    const { frames, sampleRate: rate, random } = ctx;
    const measured = profile.envelopes[seed % profile.envelopes.length];
    const stretch = 0.96 + 0.25 * params.force;
    const bands = profile.edges.map((h) => biquad('bandpass', h * (0.96 + 0.08 * random()), 0.8, rate));
    const out = renderRecording(ctx, attack, { seed, speed: 0.82 + 0.13 * random(), cutoffHz: 1950 });
    const excite = noise(random, 'white');
    for (let i = 0; i < frames; i++) {
      const t = i / rate,
        u = t / (profile.step * stretch),
        index = Math.floor(u),
        frac = u - index;
      const a = measured[Math.min(measured.length - 1, index)],
        b = measured[Math.min(measured.length - 1, index + 1)];
      const tail = Math.exp(-4 * Math.max(0, t - profile.step * (measured.length - 1) * stretch));
      let pressure = 0;
      for (let k = 0; k < bands.length; k++) {
        const env = a[k] + (b[k] - a[k]) * frac;
        pressure += bands[k](excite()) * env * Math.sqrt(rate / profile.edges[k]);
      }
      out[i] = out[i] * (0.95 + 0.4 * params.force) + pressure * tail * (0.3 + 0.24 * params.force);
    }
    return out;
  },
} satisfies SoundRecipe;
