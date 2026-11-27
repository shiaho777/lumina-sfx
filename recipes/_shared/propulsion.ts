// Two separately recorded microphone textures follow the power demand. RPM controls
// playback speed independently, so held revs can unload when the throttle closes.
import { biquad, clamp } from '../../engine/dsp.ts';
import { renderRecording, type RecordedClip } from '../../engine/recording.ts';
import type { RenderContext } from '../../engine/types.ts';

export type Motor = 'piston' | 'diesel' | 'track' | 'rotor' | 'jet' | 'fan' | 'prop' | 'outboard' | 'electric';
export type Maneuver = 'idle' | 'load' | 'cruise' | 'cabin' | 'roll-on' | 'lift' | 'approach' | 'depart' | 'surge' | 'settle';
export interface Powertrain {
  kind: Motor;
  // Effective exhaust, tread, blade, or shaft pulse rates at the two operating points.
  pulseHz: [number, number];
  timbre: number;
  // Bring out the recorded exhaust stroke on bass-heavy small motors.
  exhaustBandHz?: number;
  idleWindow: [number, number];
  powerWindow: [number, number];
}
const unit = (x: number) => clamp(x, 0, 1);

function reader(ctx: RenderContext, clip: RecordedClip, seed: number, window: [number, number]) {
  const take = clip.takes[(seed >>> 0) % clip.takes.length];
  const samples = Math.floor(take.length / 4) * 3 - (take.endsWith('==') ? 2 : take.endsWith('=') ? 1 : 0);
  const startSec = samples / (2 * clip.sampleRate) * window[0];
  const frames = Math.max(6, Math.floor(samples / (2 * clip.sampleRate) * (window[1] - window[0]) * ctx.sampleRate));
  const audio = renderRecording({ ...ctx, frames }, clip, { seed, startSec, cutoffHz: Math.min(14000, ctx.sampleRate * .34) });
  let energy = 0;
  for (const sample of audio) energy += sample * sample;
  const gain = Math.min(28, .20 / Math.max(.002, Math.sqrt(energy / frames)));
  const overlap = Math.min(Math.floor(ctx.sampleRate * .095), Math.floor(frames / 4));
  const end = frames - 2;
  const wrap = end - overlap;
  let pos = ctx.random() * Math.min(frames * .10, ctx.sampleRate * .17);
  const sample = (p: number) => {
    const i = Math.floor(p);
    return audio[i] + (audio[i + 1] - audio[i]) * (p - i);
  };
  return (speed: number) => {
    const a = sample(pos);
    const fade = pos > wrap ? (pos - wrap) / overlap : 0;
    const signal = fade ? a + (sample(pos - wrap) - a) * fade : a;
    pos += speed;
    if (pos >= end) pos -= wrap;
    return signal * gain;
  };
}

type Point = readonly [time: number, rpm: number, load: number, near: number];
const curves: Record<Maneuver, readonly Point[]> = {
  idle: [[0,.11,.08,.93], [.37,.13,.1,.92], [.73,.105,.055,.93], [1,.11,.08,.93]],
  load: [[0,.75,.91,1], [.38,.79,.94,1], [.75,.72,.87,1], [1,.75,.91,1]],
  cruise: [[0,.48,.43,.8], [.43,.5,.4,.81], [.78,.47,.46,.8], [1,.48,.43,.8]],
  cabin: [[0,.34,.35,.7], [.37,.42,.51,.7], [.72,.37,.39,.7], [1,.34,.35,.7]],
  'roll-on': [[0,.16,.16,.85], [.12,.22,.59,.88], [.39,.46,.94,.98], [.85,.9,.96,.92], [1,.92,.85,.90]],
  lift: [[0,.82,.89,.98], [.13,.88,.94,1], [.19,.79,.05,.96], [.48,.52,.06,.84], [1,.2,.09,.71]],
  approach: [[0,.56,.7,.12], [.41,.62,.78,.23], [.75,.72,.85,.57], [.93,.75,.82,1], [1,.53,.66,.88]],
  depart: [[0,.31,.66,.97], [.23,.50,.85,.88], [.57,.7,.96,.48], [.81,.7,.8,.21], [1,.64,.65,.06]],
  surge: [[0,.32,.16,.82], [.15,.49,.90,.97], [.33,.64,.81,.91], [.43,.41,.06,.84], [.56,.37,.20,.85], [.77,.76,.98,1], [1,.71,.37,.9]],
  settle: [[0,.62,.66,.84], [.23,.59,.19,.9], [.50,.44,.12,.96], [.83,.21,.10,.95], [1,.13,.08,.92]],
};

export function propulsion(ctx: RenderContext, seed: number, demand: number, rpm: number,
  state: Maneuver, spec: Powertrain, idle: RecordedClip, loaded: RecordedClip) {
  const base = reader(ctx, idle, seed, spec.idleWindow);
  const power = reader(ctx, loaded, seed + 31, spec.powerWindow);
  const curve = curves[state];
  const room = state === 'cabin';
  const airframe = ['jet','prop','rotor','fan'].includes(spec.kind);
  const bodyHz = spec.kind === 'jet' ? 210 : spec.kind === 'track' ? 102 : spec.kind === 'outboard' ? 138 : spec.pulseHz[0] * 3;
  const body = biquad('bandpass', Math.max(74, Math.min(330,bodyHz)), .70, ctx.sampleRate);
  const cab = biquad('lowpass', room ? (airframe ? 1320 : 880) : 14500, .66, ctx.sampleRate);
  const out = new Float32Array(ctx.frames);
  let knot = 0, phase = ctx.random(), periodScatter = 1, shake = 0, filtered = 0;
  const edge = spec.timbre;
  for (let i = 0; i < out.length; i += 64) {
    const t = i / ctx.frames;
    while (knot + 2 < curve.length && t > curve[knot + 1][0]) knot++;
    const from = curve[knot], to = curve[knot + 1];
    const x = unit((t - from[0]) / (to[0] - from[0]));
    const s = x * x * (3 - 2 * x);
    const rev = unit(from[1] + (to[1] - from[1]) * s + (rpm - .5) * .43);
    const load = unit(from[2] + (to[2] - from[2]) * s + (demand - .55) * .63);
    const near = from[3] + (to[3] - from[3]) * s;
    const cut = room ? 1100 + 850 * load : 500 + near * near * (5700 + 6800 * edge);
    const lp = 1 - Math.exp(-Math.PI * 2 * cut / ctx.sampleRate);
    const shift = state === 'approach' ? 1.06 - .20 * unit((t - .87) * 9) : state === 'depart' ? .98 - .13 * t : 1;
    const idleRate = (.73 + .48 * rev) * shift, loadedRate = (.69 + .61 * rev) * shift;
    const pulseRate = (spec.pulseHz[0] + rev * (spec.pulseHz[1] - spec.pulseHz[0])) * shift / ctx.sampleRate;
    const blend = .12 + .78 * load;
    const a = Math.sqrt(1 - blend), b = Math.sqrt(blend);
    const volume = (.21 + .79 * near * near) * (.62 + .38 * load);
    const until = Math.min(i + 64, out.length);
    for (let j = i; j < until; j++) {
      const intake = base(idleRate), exhaust = power(loadedRate);
      phase += pulseRate * periodScatter;
      if (phase >= 1) { phase -= 1; periodScatter = .98 + .04 * ctx.random(); shake = .83 + .32 * ctx.random(); }
      // The low register follows recorded energy. Rotor, track and propeller
      // impressions use stronger blade/tread modulation; turbines stay diffuse.
      const impulse = (1 - phase) ** 3 * shake;
      const depth = spec.kind === 'rotor' ? .58 : spec.kind === 'track' || spec.kind === 'prop' ? .34 : spec.kind === 'jet' || spec.kind === 'electric' ? .035 : .17;
      const raw = intake * a + exhaust * b * (1 + (impulse - .25) * depth);
      const shell = body(raw + (impulse - .25) * (airframe ? .055 : .10) * (.32 + load));
      filtered += lp * (raw - filtered);
      out[j] = cab(filtered + shell * (room ? .64 : .18 + .20 * edge)) * volume;
    }
  }
  if (spec.exhaustBandHz) {
    const exhaustBody = biquad('bandpass', spec.exhaustBandHz, .72, ctx.sampleRate);
    const hullRumble = biquad('highpass', 78, .71, ctx.sampleRate);
    for (let i = 0; i < out.length; i++) {
      const dry = hullRumble(out[i]);
      out[i] = dry + 1.15 * exhaustBody(dry);
    }
  }
  return out;
}
