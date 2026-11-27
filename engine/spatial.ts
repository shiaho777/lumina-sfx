// Right-handed metres: +X right, +Y up, forward -Z. Angles are degrees.
export type Vec3 = readonly [number, number, number];
export interface Pose {
  position: Vec3;
  yaw?: number;
  pitch?: number;
  roll?: number;
}
export interface Trajectory extends Pose {
  path?: readonly (Pose & { at: number; cut?: boolean })[];
}
export interface Placement extends Partial<Trajectory> {
  kind?: 'point' | 'cone' | 'area' | 'listener';
  refDistance?: number;
  rolloff?: number;
  spread?: number;
  innerAngle?: number;
  outerAngle?: number;
  outerGain?: number;
  room?: 'small_room' | 'hangar';
  air?: number;
  doppler?: boolean;
  obstruction?: number | readonly (readonly [number, number])[];
}
export type OutputMode = 'stereo' | 'headphones' | 'mono';
export type EarFilters = readonly [Float32Array, Float32Array];
export type HeadResponse = (azimuth: number, elevation: number, rate: number) => EarFilters;
const origin: Vec3 = [0, 0, 0];
const rad = Math.PI / 180;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export function bounded(n: unknown, lo: number, hi: number, field: string): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) throw Error('Invalid ' + field);
  return n;
}
function validatePose(p: Pose) {
  if (!Array.isArray(p?.position) || p.position.length !== 3)
    throw Error('Expected position [x,y,z] in metres');
  p.position.forEach((n) => bounded(n, -1e6, 1e6, 'position'));
  for (const n of [p.yaw, p.pitch, p.roll]) if (n !== undefined) bounded(n, -36000, 36000, 'angle');
}
export function validateTrajectory(p: Trajectory) {
  validatePose(p);
  if (p.path !== undefined && !Array.isArray(p.path)) throw Error('Expected path keyframes');
  let last = 0;
  for (const key of p.path ?? []) {
    validatePose(key);
    if (key.cut !== undefined && typeof key.cut !== 'boolean') throw Error('Expected a boolean cut');
    bounded(key.at, 0, 120, 'path time');
    if (key.at <= last) throw Error('Path times must increase from the initial pose at zero');
    last = key.at;
  }
}
export function validatePlacement(p: Placement) {
  if (p.room !== undefined && !['small_room', 'hangar'].includes(p.room)) throw Error('Unknown doorway room');
  validateTrajectory({ ...p, position: p.position ?? origin });
  if (!['point', 'cone', 'area', 'listener'].includes(p.kind ?? 'point')) throw Error('Unknown emitter kind');
  bounded(p.refDistance ?? 1, 0.01, 1e5, 'refDistance');
  bounded(p.rolloff ?? 1, 0, 8, 'rolloff');
  bounded(p.spread ?? 0, 0, 1, 'spread');
  bounded(p.air ?? 1, 0, 4, 'air');
  bounded(p.innerAngle ?? 60, 0, 360, 'innerAngle');
  bounded(p.outerAngle ?? 150, p.innerAngle ?? 60, 360, 'outerAngle');
  bounded(p.outerGain ?? 0.25, 0, 1, 'outerGain');
  if (p.doppler !== undefined && typeof p.doppler !== 'boolean') throw Error('Expected boolean doppler');
  if (Array.isArray(p.obstruction)) {
    let last = -1;
    if (!p.obstruction.length) throw Error('Empty obstruction curve');
    for (const pair of p.obstruction) {
      if (!Array.isArray(pair) || pair.length !== 2) throw Error('Expected obstruction [seconds, amount]');
      bounded(pair[0], 0, 120, 'obstruction time');
      bounded(pair[1], 0, 1, 'obstruction');
      if (pair[0] <= last) throw Error('Obstruction times must increase');
      last = pair[0];
    }
  } else bounded(p.obstruction ?? 0, 0, 1, 'obstruction');
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function angle(a = 0, b = 0, t: number) {
  return a + (((((b - a + 180) % 360) + 360) % 360) - 180) * t;
}
export function poseAt(p: Partial<Trajectory>, t: number): Pose {
  let prev: Pose = p.position ? (p as Pose) : { ...p, position: origin },
    start = 0;
  for (const next of p.path ?? []) {
    if (t < next.at) {
      if (next.cut) return prev;
      const u = clamp((t - start) / (next.at - start), 0, 1);
      const [x, y, z] = prev.position;
      return {
        position: [lerp(x, next.position[0], u), lerp(y, next.position[1], u), lerp(z, next.position[2], u)],
        yaw: angle(prev.yaw, next.yaw ?? prev.yaw, u),
        pitch: angle(prev.pitch, next.pitch ?? prev.pitch, u),
        roll: angle(prev.roll, next.roll ?? prev.roll, u),
      };
    }
    prev = { ...prev, ...next };
    start = next.at;
  }
  return prev;
}
function direction(p: Pose): Vec3 {
  const a = (p.yaw ?? 0) * rad,
    b = (p.pitch ?? 0) * rad;
  return [Math.sin(a) * Math.cos(b), Math.sin(b), -Math.cos(a) * Math.cos(b)];
}
function obstructionAt(curve: Placement['obstruction'], t: number) {
  if (typeof curve === 'number' || !curve) return curve ?? 0;
  let prev = curve[0];
  for (const next of curve.slice(1)) {
    if (t <= next[0]) return lerp(prev[1], next[1], clamp((t - prev[0]) / (next[0] - prev[0]), 0, 1));
    prev = next;
  }
  return prev[1];
}
export const roomTaps = {
  small_room: [
    [0.013, 0.13],
    [0.031, 0.08],
    [0.053, 0.04],
  ],
  hangar: [
    [0.035, 0.18],
    [0.078, 0.12],
    [0.145, 0.075],
    [0.218, 0.045],
  ],
} as const;
export function relativePose(p: Placement, listener: Trajectory, t: number) {
  const a = poseAt(p, t),
    ear = poseAt(listener, t);
  const [x, y, z] = a.position.map((v, i) => v - ear.position[i]);
  const distance = Math.hypot(x, y, z),
    yaw = (ear.yaw ?? 0) * rad,
    pitch = (ear.pitch ?? 0) * rad,
    roll = (ear.roll ?? 0) * rad;
  const horizontal = x * Math.sin(yaw) - z * Math.cos(yaw);
  const right = x * Math.cos(yaw) + z * Math.sin(yaw),
    up = y * Math.cos(pitch) - horizontal * Math.sin(pitch);
  const localX = right * Math.cos(roll) + up * Math.sin(roll);
  const localY = up * Math.cos(roll) - right * Math.sin(roll);
  const front = horizontal * Math.cos(pitch) + y * Math.sin(pitch);
  const azimuth = Math.atan2(localX, front) / rad,
    elevation = Math.atan2(localY, Math.hypot(localX, front)) / rad;
  const ref = p.refDistance ?? 1,
    rolloff = p.rolloff ?? 1;
  const obstruction = obstructionAt(p.obstruction, t);
  let gain = ref / (ref + rolloff * Math.max(0, distance - ref));
  if (p.kind === 'cone' && distance > 1e-7) {
    const f = direction(a),
      theta = (2 * Math.acos(clamp(-(f[0] * x + f[1] * y + f[2] * z) / distance, -1, 1))) / rad;
    const inner = p.innerAngle ?? 60,
      outer = p.outerAngle ?? 150;
    const blend = theta <= inner ? 0 : clamp((theta - inner) / Math.max(1e-6, outer - inner), 0, 1);
    gain *= lerp(1, p.outerGain ?? 0.25, blend);
  }
  const cutoff =
    (20000 / (1 + 0.014 * (p.air ?? 1) * Math.max(0, distance - ref))) * Math.pow(0.045, obstruction);
  return {
    azimuth,
    elevation,
    distance,
    gain: gain * (1 - 0.52 * obstruction),
    obstruction,
    pan: localX / Math.max(distance, 0.05),
    cutoff,
  };
}
function convolve(input: Float32Array, frame: number, kernel: Float32Array) {
  let value = 0;
  for (let tap = 0, n = Math.min(kernel.length, frame + 1); tap < n; tap++)
    value += input[frame - tap] * kernel[tap];
  return value;
}
// Render at the listener on one scene clock. A point uses the mono sum, an area also retains
// its native stereo field. A listener-relative recording bypasses the world transform.
export function placeAudio(
  input: readonly Float32Array[],
  p: Placement,
  listener: Trajectory,
  output: OutputMode,
  rate: number,
  offset: number,
  head?: HeadResponse,
): Float32Array[] {
  const left = input[0],
    right = input[1] ?? left;
  if (p.kind === 'listener')
    return output === 'mono' ? [left.map((v, i) => (v + right[i]) * 0.5)] : [left, right];
  const n = left.length,
    out = [new Float32Array(n), new Float32Array(n)],
    mono = new Float32Array(n);
  const width = p.spread ?? (p.kind === 'area' ? 0.85 : 0);
  const moving = Boolean(p.path?.length || listener.path?.length || Array.isArray(p.obstruction));
  let state = relativePose(p, listener, offset),
    filters = head?.(state.azimuth, state.elevation, rate);
  const echoes = p.room ? roomTaps[p.room].map(([time, g]) => [Math.round(time * rate), g] as const) : [];
  let read = 0,
    lp = 0,
    sideLP = 0;
  // Keep dry playback running across camera cuts. Stop the preceding interpolation at
  // the picture boundary and crossfade the two acoustic states just after the cut.
  const cuts = new Set([...p.path ?? [], ...listener.path ?? []]
    .filter(key => key.cut && key.at > offset)
    .map(key => Math.ceil((key.at - offset) * rate)));
  const boundaries = [...cuts].filter(frame => frame < n).sort((a, b) => a - b);
  let boundary = 0;
  for (let begin = 0; begin < n;) {
    const afterCut = cuts.has(begin);
    if (afterCut) boundary++;
    const end = Math.min(n, boundaries[boundary] ?? n, begin + (afterCut ? Math.min(256, Math.ceil(0.008 * rate)) : 256));
    const size = end - begin;
    const nextTime = offset + (cuts.has(end) ? end - 1 : end) / rate;
    const next = moving ? relativePose(p, listener, nextTime) : state;
    const newFilters =
      moving &&
      (Math.abs(next.azimuth - state.azimuth) > 1e-5 || Math.abs(next.elevation - state.elevation) > 1e-5)
        ? head?.(next.azimuth, next.elevation, rate)
        : filters;
    const startDistance = afterCut ? relativePose(p, listener, offset + begin / rate).distance : state.distance;
    const velocity = ((next.distance - startDistance) * rate) / size;
    const step = p.doppler ? clamp(343 / (343 + clamp(velocity, -170, 300)), 0.55, 1.8) : 1;
    for (let j = 0; j < size; j++) {
      const i = begin + j,
        t = j / size,
        k = Math.floor(read),
        u = read - k;
      const l = lerp(left[k] ?? 0, left[k + 1] ?? 0, u),
        r = lerp(right[k] ?? 0, right[k + 1] ?? 0, u);
      const cutoff = Math.min(rate * 0.45, lerp(state.cutoff, next.cutoff, t));
      const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
      lp += alpha * ((l + r) * 0.5 - lp);
      sideLP += alpha * ((l - r) * 0.5 - sideLP);
      mono[i] = lp;
      const gain = lerp(state.gain, next.gain, t),
        pan = clamp(lerp(state.pan, next.pan, t), -1, 1);
      let room = 0;
      for (const [delay, g] of echoes) if (i >= delay) room += mono[i - delay] * g;
      room *= 0.15 + 0.85 * lerp(state.obstruction, next.obstruction, t);
      for (let ch = 0; ch < 2; ch++) {
        let direct: number;
        if (filters && newFilters) {
          const a = convolve(mono, i, filters[ch]);
          direct = filters === newFilters ? a : lerp(a, convolve(mono, i, newFilters[ch]), t);
        } else direct = lp * Math.sqrt(0.5 * (1 + (ch ? pan : -pan)));
        out[ch][i] = gain * (room + direct * (1 - width) + width * (lp + (ch ? -sideLP : sideLP)));
      }
      read += step;
    }
    state = next;
    filters = newFilters;
    begin = end;
  }
  return output === 'mono' ? [out[0].map((v, i) => (v + out[1][i]) * 0.5)] : out;
}
