import { biquad } from '../../engine/dsp.ts';
import type { RecordedClip } from '../../engine/recording.ts';
import type { RenderContext } from '../../engine/types.ts';
import { sustain, roomReturns, type AcousticSpace } from './field-layers.ts';

type Movement = 'scattered' | 'steady' | 'surge' | 'retreat';

// The recording supplies both flame and wood settling. Only the bright edge of
// a sharp snap is compressed, so the sustained burn keeps its level.
export function woodFire(
  ctx: RenderContext,
  burn: RecordedClip,
  seed: number,
  sparks: number,
  size: number,
  space: AcousticSpace,
  movement: Movement,
  brightness: number,
  variedWindows = false,
) {
  const rate = ctx.sampleRate;
  const source = sustain(ctx, burn, seed, .87 + .17 * size, 5500 + 3100 * brightness, variedWindows);
  const rumbleCut = biquad('highpass', 47 + 27 * (1 - size), .68, rate);
  const warmth = biquad('lowpass', 410 + 260 * size, .67, rate);
  const mid = biquad('lowpass', 1450 + 1050 * brightness, .68, rate);
  const relax = Math.exp(-1 / (.023 * rate));
  const ceiling = .028 + .10 * sparks;
  let envelope = 0;

  for (let i = 0; i < source.length; i++) {
    const x = rumbleCut(source[i]);
    const low = warmth(x);
    const body = mid(x);
    const edge = x - body;
    envelope = Math.max(Math.abs(edge), envelope * relax);

    const t = i / Math.max(1, source.length - 1);
    const ease = t * t * (3 - 2 * t);
    let activity = .94;
    if (movement === 'surge') activity = .20 + .80 * ease;
    if (movement === 'retreat') activity = 1 - .81 * ease;
    if (movement === 'scattered') activity = .78 + .12 * Math.sin(4.1 * t + size);

    source[i] = activity * (
      low * (1.03 + .24 * size) +
      (body - low) * (.77 + .20 * sparks) +
      edge * (.39 + .57 * sparks) / (1 + .67 * envelope / ceiling)
    );
  }
  return space === 'open' ? source : roomReturns(ctx, source, space);
}
