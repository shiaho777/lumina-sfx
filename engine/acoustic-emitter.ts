// Approximate free-field propagation for authored game emitters. Source strengths are
// relative to the mastered recipe; they are mix starting points, not calibrated SPL.
import { bounded, poseAt, relativePose } from './spatial.ts';
import type { Placement, Pose, Trajectory, Vec3 } from './spatial.ts';
import type { RemixLayer } from './remix.ts';

const sources = {
  general: { radius: 1, trim: 0 },
  turbine: { radius: 12, trim: 4 },
  rainfall: { radius: 2, trim: -9 },
  thunder: { radius: 230, trim: 5.5 },
  vehicle: { radius: 3, trim: 0 },
  foley: { radius: 1, trim: 0 },
} as const;
// Listener-relative bearings and elevations in degrees at emission time.
const directions = {
  front: [0, 0], 'front-right': [45, 0], right: [90, 0], 'rear-right': [135, 0],
  rear: [180, 0], 'rear-left': [-135, 0], left: [-90, 0], 'front-left': [-45, 0],
  overhead: [0, 90], below: [0, -90],
} as const;
export interface Acoustics {
  direction?: keyof typeof directions;
  source?: keyof typeof sources;
  distanceM?: number;
  bearingDeg?: number;
  elevationDeg?: number;
  through?: 'open' | 'canopy' | 'wall';
  travel?: boolean;
}
export interface Arrival {
  source: keyof typeof sources;
  distanceM: number;
  emissionSec: number;
  travelSec: number;
  through: string;
  sourceTrimDb: number;
}
const rad = Math.PI / 180;
function fromListener(ear: Pose, distance: number, bearing: number, elevation: number): Vec3 {
  const yaw = (ear.yaw ?? 0) * rad,
    pitch = (ear.pitch ?? 0) * rad,
    roll = (ear.roll ?? 0) * rad;
  const localRight = Math.sin(bearing * rad) * Math.cos(elevation * rad),
    localUp = Math.sin(elevation * rad),
    localFront = Math.cos(bearing * rad) * Math.cos(elevation * rad);
  const right = localRight * Math.cos(roll) - localUp * Math.sin(roll),
    up = localRight * Math.sin(roll) + localUp * Math.cos(roll);
  const forward = localFront * Math.cos(pitch) - up * Math.sin(pitch);
  return [
    ear.position[0] + distance * (right * Math.cos(yaw) + forward * Math.sin(yaw)),
    ear.position[1] + distance * (up * Math.cos(pitch) + localFront * Math.sin(pitch)),
    ear.position[2] + distance * (right * Math.sin(yaw) - forward * Math.cos(yaw)),
  ];
}
// Intersect an expanding wavefront with each straight segment of the listener
// path. This also handles a fast listener that crosses the wave twice on one leg.
function travelTime(origin: Vec3, listener: Trajectory, emission: number) {
  const c = 343,
    speed2 = c * c;
  let start = emission,
    ear = poseAt(listener, emission).position;
  for (const key of listener.path ?? []) {
    if (key.at <= start) continue;
    const dt = key.at - start,
      elapsed = start - emission;
    const delta = ear.map((v, i) => v - origin[i]);
    const velocity = key.position.map((v, i) => (v - ear[i]) / dt);
    const a = velocity.reduce((s, v) => s + v * v, 0) - speed2;
    const b = 2 * (delta.reduce((s, v, i) => s + v * velocity[i], 0) - speed2 * elapsed);
    const d = delta.reduce((s, v) => s + v * v, 0) - speed2 * elapsed * elapsed;
    if (d <= 0) return elapsed;
    const disc = b * b - 4 * a * d;
    if (disc >= 0) {
      const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(disc));
      const roots = Math.abs(a) < 1e-8 ? [-d / b] : [q / a, d / q];
      const within = roots.filter((x) => x >= 0 && x <= dt);
      if (within.length) return elapsed + Math.min(...within);
    }
    start = key.at;
    ear = key.position;
  }
  return Math.hypot(ear[0] - origin[0], ear[1] - origin[1], ear[2] - origin[2]) / c;
}
export function resolveEmitter(
  layer: RemixLayer & { placement?: Placement; acoustics?: Acoustics },
  listener: Trajectory,
) {
  const a = layer.acoustics;
  if (!a)
    return { placement: layer.placement, gain: layer.gain, offsetSec: layer.offsetSec, arrival: undefined };
  const r = layer.recipe;
  const source =
    a.source ??
    (r.tags.includes('thunder')
      ? 'thunder'
      : r.tags.includes('rain')
        ? 'rainfall'
        : r.tags.some((t) => ['jet', 'turbofan', 'turbine'].includes(t))
          ? 'turbine'
          : r.mixRole === 'vehicle'
            ? 'vehicle'
            : 'general');
  if (!Object.hasOwn(sources, source)) throw Error('Unknown acoustic source');
  const through = a.through ?? 'open';
  if (!['open', 'canopy', 'wall'].includes(through)) throw Error('Unknown acoustic boundary');
  if (a.travel !== undefined && typeof a.travel !== 'boolean') throw Error('travel must be boolean');
  const p = layer.placement ?? {},
    emission = layer.offsetSec ?? 0;
  if (a.distanceM !== undefined && p.position) throw Error('Choose distanceM or world position, not both');
  if (a.direction !== undefined && !Object.hasOwn(directions, a.direction)) throw Error('Unknown emitter direction');
  if (a.direction !== undefined && (a.bearingDeg !== undefined || a.elevationDeg !== undefined))
    throw Error('Choose direction or numeric angles');
  const angles = a.direction === undefined ? [0, 0] : directions[a.direction];
  if ((a.direction !== undefined || a.bearingDeg !== undefined || a.elevationDeg !== undefined) && a.distanceM === undefined)
    throw Error('Bearing and elevation need distanceM');
  if (a.distanceM === undefined && !p.position)
    throw Error('Acoustics needs distanceM or a world position');
  if (p.kind === 'listener') throw Error('World acoustics need a world emitter');
  const distance = bounded(a.distanceM ?? 0, 0, 40000, 'distanceM'),
    bearing = bounded(a.bearingDeg ?? angles[0], -360, 360, 'bearingDeg'),
    elevation = bounded(a.elevationDeg ?? angles[1], -90, 90, 'elevationDeg');
  if (through !== 'open' && p.obstruction !== undefined)
    throw Error('Choose a boundary or an obstruction curve');
  const placement: Placement = {
    kind: source === 'rainfall' ? 'area' : 'point',
    refDistance: sources[source].radius,
    obstruction: through === 'canopy' ? 0.34 : through === 'wall' ? 0.68 : 0,
    ...p,
    position: p.position ?? fromListener(poseAt(listener, emission), distance, bearing, elevation),
  };
  const state = relativePose(placement, listener, emission);
  const travel = a.travel ?? (!r.loopable && source === 'thunder');
  if (travel && (layer.afterLayer || layer.atMarker || r.loopable))
    throw Error('Travel time requires a discrete emission at an explicit scene time');
  let travelSec = 0;
  if (travel) {
    // Emission stays fixed while the listener can move before the event reaches their ears.
    const emitted = poseAt(placement, emission);
    travelSec = travelTime(emitted.position, listener, emission);
    if (placement.path?.length) {
      placement.position = emitted.position;
      placement.yaw = emitted.yaw;
      placement.pitch = emitted.pitch;
      placement.roll = emitted.roll;
      delete placement.path;
    }
  }
  const trim = sources[source].trim + (through === 'canopy' ? -3 : through === 'wall' ? -7 : 0);
  return {
    placement,
    gain: layer.gain,
    offsetSec: travel ? emission + travelSec : layer.offsetSec,
    arrival: {
      source,
      distanceM: state.distance,
      emissionSec: emission,
      travelSec,
      through,
      sourceTrimDb: trim,
    } satisfies Arrival,
  };
}
