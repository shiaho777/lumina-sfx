import { biquad, layer } from '../../engine/dsp.ts';
import { renderRecording, type RecordedClip } from '../../engine/recording.ts';
import type { SoundRecipe } from '../../engine/types.ts';

// Case resonance, decay and snap describe the mechanism independently of its gesture.
export interface Mechanism {
  bodyHz: number;
  decayMs: number;
  cutoffHz: number;
  snap: number;
  rattle: number;
  plateHz?: number;
}

interface CapturedMechanism {
  captured: true;
  pairedTakes: boolean;
  cutoffHz: number;
}

export interface Contact {
  at: number;
  weight: number;
  pitch: number;
  release?: boolean;
}

export function editorContact(id: string, name: string, tags: string[], durationSec: number,
  source: RecordedClip, mechanism: Mechanism | CapturedMechanism, contacts: Contact[]): SoundRecipe {
  return {
    id, name, tags, durationSec, category: 'Footsteps & UI', loopable: false, isolation: 'isolated',
    perspective: 'close and dry', contains: tags.includes('typing') ? ['typing phrase'] : ['device contact'],
    markers: { contact: 0 }, mixRole: 'interface', targetRmsDbfs: -26, recording: source.credit,
    params: { pressure: { label: 'Contact pressure', min: 0, max: 1, default: 0.45 } },
    render(ctx, { seed, params }) {
      const out = new Float32Array(ctx.frames);
      for (const [index, hit] of contacts.entries()) {
        const release = hit.release === true;
        if ('captured' in mechanism) {
          // These takes include the real case or tablet body. Play only the observed side of the switch.
          const count = source.takes.length / (mechanism.pairedTakes ? 2 : 1);
          const take = (seed + index) % count + (mechanism.pairedTakes && release ? count : 0);
          const speed = hit.pitch * (0.99 + 0.02 * ctx.random());
          const cutoffHz = mechanism.cutoffHz * (0.85 + params.pressure * 0.3);
          layer(ctx, out, hit.at, durationSec - hit.at, part =>
            renderRecording(part, source, { seed: take, speed, cutoffHz }), hit.weight);
          continue;
        }
        const pitch = hit.pitch * (0.976 + ctx.random() * 0.048) * (release ? 1.19 : 1);
        const decay = mechanism.decayMs * 0.001 * (release ? 0.6 : 1);
        const at = hit.at === 0 ? 0 : hit.at + (ctx.random() - 0.5) * Math.min(.009, hit.at * .09);
        layer(ctx, out, at, Math.max(.045, decay * 6), part => {
          // Keyboard banks keep strikes in the first half and lighter returns in the second.
          const isKey = tags.includes('keyboard');
          const takeCount = isKey ? source.takes.length / 2 : source.takes.length;
          const take = (seed + index) % takeCount + (isKey && release ? takeCount : 0);
          const sample = renderRecording(part, source, { seed: take, speed: pitch,
            cutoffHz: mechanism.cutoffHz * (.83 + .31 * params.pressure) });
          const hz = mechanism.bodyHz * pitch;
          const caseBody = biquad('bandpass', hz, .75 + decay * 65, part.sampleRate);
          const keycap = biquad('bandpass', hz * 2.43, 1.1, part.sampleRate);
          const spring = biquad('bandpass', hz * 4.61, 2.4, part.sampleRate);
          const plate = mechanism.plateHz ? biquad('highpass', mechanism.plateHz * .64, .7, part.sampleRate) : undefined;
          for (let i = 0; i < sample.length; i++) {
            const dry = sample[i];
            const clack = plate ? plate(dry) * (release ? .30 : .90) : 0;
            sample[i] = dry * (.60 + .33 * mechanism.snap) + caseBody(dry) * (release ? .47 : 1.25)
              + .32 * keycap(dry) + 2 * mechanism.rattle * spring(dry) + clack;
            sample[i] = .65 * Math.tanh(sample[i] / .65);
          }
          if (isKey && !release) {
            // Early, damped reflections through the case follow the recorded strike and fuse with it.
            const warmth = biquad('lowpass', Math.min(2600, hz * 3.6), .68, part.sampleRate);
            const body = sample.map(warmth);
            let dryEnergy = 0, bodyEnergy = 0;
            for (let i = 0; i < sample.length; i++) {
              dryEnergy += sample[i] ** 2;
              bodyEnergy += body[i] ** 2;
            }
            const coupling = Math.min(3.2, Math.sqrt(dryEnergy / Math.max(1e-12, bodyEnergy)));
            const depth = coupling * Math.min(plate ? .72 : 1.1, decay * 54);
            for (const [fraction, level] of [[.19,.59],[.43,-.48],[.72,.41],[1.03,.35],[1.37,-.26],[1.76,.20]]) {
              const delay = Math.max(1, Math.round(decay * fraction * part.sampleRate));
              for (let i=delay; i<sample.length; i++) sample[i] += depth * level * body[i-delay];
            }
          }
          return sample;
        }, hit.weight * (.9 + .1 * ctx.random()));
      }
      return out;
    },
  };
}
