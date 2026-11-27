import { biquad } from '../../engine/dsp.ts';
import { renderRecording, type RecordedClip } from '../../engine/recording.ts';
import type { RenderContext } from '../../engine/types.ts';

// Carry one unbroken splash across the waterline. The listener loses air detail
// on the way down and recovers it as the water sheds on the way back up.
export function waterCrossing(ctx: RenderContext, clip: RecordedClip, force: number, entering: boolean) {
  const speed = .96 + .08 * force + .025 * (ctx.random() - .5);
  const sound = renderRecording(ctx, clip, { speed });
  const rate = ctx.sampleRate;
  const submerged = biquad('lowpass', 590 + 400 * force, .66, rate);
  const clear = biquad('lowpass', Math.min(rate * .43, 5200 + 3800 * force), .68, rate);
  for (let i = 0; i < sound.length; i++) {
    const time = i / rate;
    const fraction = Math.min(1, Math.max(0, (time - (entering ? .055 : .035)) / (entering ? .32 : .24)));
    const eased = fraction * fraction * (3 - 2 * fraction);
    const wet = entering ? .92 * eased : .84 * (1 - eased);
    const dry = clear(sound[i]);
    const covered = submerged(dry);
    const release = Math.min(1, (sound.length - 1 - i) / (.16 * rate));
    sound[i] = (dry + (covered - dry) * wet) * release;
  }
  return sound;
}
