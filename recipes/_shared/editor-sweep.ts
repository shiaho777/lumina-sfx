import { biquad, noise, clamp } from '../../engine/dsp.ts';
import { renderRecording, type RecordedClip } from '../../engine/recording.ts';
import type { SoundRecipe, RenderContext } from '../../engine/types.ts';

export interface SweepTexture {
  lowHz: number;
  highHz: number;
  grainHz: number;
  grainDepth: number;
  air: number;
  body: number;
}
export interface Gesture {
  duration: number;
  apex: number;
  direction: number;
  travel: number;
  reverse: boolean;
  echo: number;
  turn?: boolean;
  screenPath?: readonly (readonly [number, number])[];
}

export function sweepAudio(ctx: RenderContext, detail: number, seed: number, texture: SweepTexture,
  gesture: Pick<Gesture, 'duration' | 'apex' | 'reverse' | 'echo' | 'turn'>, friction?: RecordedClip) {
  const colored = noise(ctx.random, 'pink');
  const body = biquad('bandpass', texture.lowHz * (.78 + .28 * detail), .72, ctx.sampleRate);
  const airLimit = biquad('lowpass', Math.min(12200, 2800 + texture.highHz * .88), .66, ctx.sampleRate);
  const signal = new Float32Array(ctx.frames);
  const rubbing = friction && renderRecording(ctx, friction, { seed, speed: .86 + .22 * ctx.random(),
    cutoffHz: Math.min(7600, texture.highHz * 1.22) });
  const rubStart = Math.max(0, Math.round((gesture.apex * gesture.duration - .069) * ctx.sampleRate));
  const fadeIn = Math.min(.085, gesture.apex * gesture.duration) * ctx.sampleRate;
  const fadeOut = Math.min(.12, (1 - gesture.apex) * gesture.duration) * ctx.sampleRate;
  const accentFrame = gesture.apex * gesture.duration * ctx.sampleRate;
  const accentWidth = Math.min(0.085, gesture.duration * 0.15) * ctx.sampleRate;
  let bandState = 0, lowState = 0, grain = 0, grainTarget = 0, remaining = 0, g = 0;
  const grainFollow = 1 - Math.exp(-texture.grainHz * 3 / ctx.sampleRate);
  const delay = Math.max(1, Math.round(.046 * ctx.sampleRate));
  for (let i = 0; i < signal.length; i++) {
    const u = i / Math.max(1, signal.length - 1);
    const rise = Math.min(1, u / gesture.apex);
    const fall = Math.max(0, (u - gesture.apex) / (1 - gesture.apex));
    // A moving strip has a continuous friction bed. Its marked day gives it a
    // broad crest, with a short ease to rest at each end of the actual stroke.
    // Shape the existing stream of friction around the visible accent. A soft
    // 170 ms crest remains apparent when opposite stereo strokes fold to mono.
    const crest = gesture.turn ? 1 + 0.85 * Math.exp(-0.5 * ((i - accentFrame) / accentWidth) ** 2) : 1;
    const weight = gesture.turn
      ? Math.sin(Math.PI * .5 * Math.min(1, i / fadeIn)) *
        Math.sin(Math.PI * .5 * Math.min(1, (signal.length - 1 - i) / fadeOut)) *
        crest * (.38 + .62 * Math.sin(Math.PI * .5 * rise) ** 1.4) * (1 - .64 * fall)
      : (.04 + .96 * Math.sin(Math.PI * .5 * rise) ** 1.65) * (1 - fall) ** 2.45;
    const motion = gesture.reverse ? 1 - u : u;
    if (remaining-- <= 0) {
      grainTarget = ctx.random() * 2 - 1;
      remaining = Math.round(ctx.sampleRate / texture.grainHz * (.58 + ctx.random()*.91));
    }
    grain += grainFollow * (grainTarget - grain);
    // A swept state-variable filter keeps its history as the pass moves through the frame.
    if ((i & 15) === 0) {
      const center = texture.lowHz * 1.13 * (texture.highHz / texture.lowHz) ** (.13 + .74 * motion);
      g = Math.tan(Math.PI * clamp(center * (.82 + detail*.36), 80, ctx.sampleRate*.43) / ctx.sampleRate);
    }
    const excitation = airLimit(ctx.random() * 2 - 1);
    const band = (bandState + g * (excitation - lowState)) / (1 + g*(g+1.25));
    const low = lowState + g * band;
    bandState = 2 * band - bandState;
    lowState = 2 * low - lowState;
    const textureLevel = 1 + grain * texture.grainDepth * .64;
    const air = .67 * band + texture.air * .48 * excitation;
    const brush = rubbing && i >= rubStart ? rubbing[i-rubStart] : 0;
    signal[i] = weight * (textureLevel * (air + body(colored()) * texture.body * (.86-.33*motion)) +
      brush * (gesture.turn ? .18 : 1.35)) + (i >= delay ? signal[i-delay] * gesture.echo * .65 : 0);
  }
  return signal;
}

export function editorSweep(id: string, name: string, tags: string[], texture: SweepTexture, gesture: Gesture, friction?: RecordedClip): SoundRecipe {
  const recipe: SoundRecipe = {
    id, name, tags, durationSec: gesture.duration, isolation: 'isolated', loopable: false, category: 'Sci-Fi & UI',
    perspective: 'editorial transition', contains: ['one continuous gesture'], mixRole: 'interface', targetRmsDbfs: -26,
    recording: friction?.credit,
    markers: { apex: gesture.duration * gesture.apex },
    params: { detail: { label: 'Texture brightness', min: 0, max: 1, default: .46 } },
    render(ctx, { params, seed }) { return sweepAudio(ctx, params.detail, seed, texture, gesture, friction); },
  };
  if (!gesture.direction) return recipe;
  const fitGesture: NonNullable<SoundRecipe['withGestureTiming']> = (durationSec, apexSec, motion, screenPath) => {
    if (!Number.isFinite(durationSec) || durationSec < 0.01 || durationSec > 120 ||
        !Number.isFinite(apexSec) || apexSec <= 0 || apexSec >= durationSec)
      throw new RangeError('Put the swipe apex inside its 0.01–120 second duration');
    if (screenPath && (screenPath.length < 2 || screenPath[0]?.[0] !== 0 || screenPath.at(-1)?.[0] !== 1 ||
        screenPath.some(([time, progress], i) => !Number.isFinite(time) || !Number.isFinite(progress) ||
          progress < 0 || progress > 1 || (i > 0 && time <= screenPath[i-1][0]))))
      throw new RangeError('Screen travel must span normalized time 0–1 with finite positions in 0–1');
    // Always fit from the original texture, including when an editor revises a fitted take.
    const moving = { ...texture, body: texture.body * 0.35, air: texture.air + 0.12 };
    const fitted = editorSweep(id, name, tags, moving, {
      ...gesture, screenPath, duration: durationSec, apex: apexSec / durationSec,
      turn: motion === 'turn', reverse: motion === 'turn' ? gesture.direction < 0 : gesture.reverse,
    }, friction);
    return { ...fitted, withGestureTiming: fitGesture };
  };
  return { ...recipe, withGestureTiming: fitGesture,
    renderStereo(ctx, { params, seed }) {
      const mono = sweepAudio(ctx, params.detail, seed, texture, gesture, friction);
      const left = new Float32Array(mono.length), right = new Float32Array(mono.length);
      const path = gesture.screenPath;
      let segment = 1;
      for (let i = 0; i < mono.length; i++) {
        const at = i / Math.max(1, mono.length - 1);
        let travel;
        if (path) {
          while (segment < path.length - 1 && at > path[segment][0]) segment++;
          const [t0, x0] = path[segment-1], [t1, x1] = path[segment];
          travel = 1 - 2 * (x0 + (x1-x0) * (at-t0)/(t1-t0));
        } else travel = Math.cos(Math.PI * at);
        const angle = Math.PI / 4 * (1 - gesture.direction * gesture.travel * travel);
        left[i] = mono[i] * Math.cos(angle);
        right[i] = mono[i] * Math.sin(angle);
      }
      return [left, right];
    },
  };
}
