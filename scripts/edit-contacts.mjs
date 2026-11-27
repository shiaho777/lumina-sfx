import { deviceKind } from './edit-device.mjs';

// Inspect only the soundtrack around marked contacts. Never infer the meaning of a transient
// from its loudness alone; an identical, editor-confirmed input can identify another take.
const rate = 12000,
  pad = 1440;
const physical = new Set([
  'press',
  'tab',
  'focus',
  'toggle-on',
  'toggle-off',
  'confirm',
  'commit',
  'back',
  'snap',
  'type',
  'paste', 'undo','redo','disabled',
]);
export function contactProbes(events, fps, projectDevice) {
  const spans = [];
  for (const e of events) {
    if (!physical.has(e.action) || e.muted || e.sourceContact === false) continue;
    const keys = e.keyFrames ?? [e.syncFrame ?? e.frame];
    const device = e.device ?? projectDevice;
    const kind = deviceKind(typeof device === 'string' ? device : '');
    let mechanism = kind;
    if (kind === 'unspecified') mechanism = e.action;
    if (kind === 'unknown') mechanism = device;
    const group = JSON.stringify([mechanism, e.family]);
    for (const frame of keys) {
      const center = Math.round((frame / fps) * rate);
      spans.push({
        id: e.id,
        frame,
        center,
        group,
        known: e.sourceContact === true,
        first: center - pad,
        samples: new Float32Array(2 * pad),
      });
    }
  }
  spans.sort((a, b) => a.first - b.first);
  let cursor = 0,
    active = [];
  return {
    write(block, first, side) {
      const end = first + block.length;
      while (cursor < spans.length && spans[cursor].first < end) active.push(spans[cursor++]);
      for (const s of active) {
        const lo = Math.max(first, s.first),
          hi = Math.min(end, s.first + 2 * pad);
        if (hi <= lo) continue;
        s.samples.set(block.subarray(lo - first, hi - first), lo - s.first);
        if (side) {
          s.side ??= new Float32Array(2 * pad);
          s.side.set(side.subarray(lo - first, hi - first), lo - s.first);
        }
      }
      active = active.filter((s) => s.first + 2 * pad > end);
    },
    finish() {
      const hits = spans
        .map((s) => {
          // A wide original may cancel in the middle. A side-only attack still
          // needs a matching confirmed performance before it can be reused.
          const middle = contactHit(s.samples, fps);
          const side = s.side && contactHit(s.side, fps);
          const hit = side && (!middle || side.power > middle.power) ? side : middle;
          return { ...s, hit };
        })
        .filter((s) => s.hit);
      const confirmed = hits.filter((s) => s.known);
      const contacts = Object.create(null);
      for (const s of hits) {
        const match = confirmed.find(
          (k) => k.id !== s.id && k.group === s.group && similar(k.hit.wave, s.hit.wave),
        );
        (contacts[s.id] ??= []).push({
          frame: s.frame,
          decision: match ? 'reuse' : 'review',
          offsetMs: s.hit.offsetMs,
          ...(match ? { matches: match.id } : {}),
        });
      }
      return contacts;
    },
  };
}
function contactHit(samples, fps) {
  const hit = impulse(samples, fps);
  if (hit) return hit;
  // A short switch can still have a sharp edge above a vowel.
  const edge = samples.map((v, i) => (i ? v - samples[i - 1] : 0));
  return impulse(edge, fps);
}
function impulse(x, fps) {
  const hop = 24,
    bins = [];
  for (let j = 0; j < x.length; j += hop) {
    let power = 0;
    for (let i = j; i < j + hop; i++) power += x[i] * x[i];
    bins.push(power / hop);
  }
  const middle = pad / hop,
    tol = Math.round((Math.min(0.033, Math.max(0.01, 0.65 / fps)) * rate) / hop);
  let best = middle;
  for (let i = middle - tol; i <= middle + tol; i++) if (bins[i] > bins[best]) best = i;
  const power = bins[best];
  if (power < 1e-6) return;
  const floor = bins.filter((v, i) => Math.abs(i - best) > 20).sort((a, b) => a - b);
  if (power < Math.max(1e-7, floor[Math.floor(floor.length * 0.8)]) * 20) return;
  let left = best,
    right = best;
  while (left > 0 && bins[left - 1] > power * 0.055) left--;
  while (right < bins.length - 1 && bins[right + 1] > power * 0.055) right++;
  if (right - left > 17 || best - left > 8) return;
  // A speech harmonic can peak sharply inside a syllable while its neighbours
  // remain loud. A physical switch has a brief attack above its immediate bed.
  const average=(from,to)=>bins.slice(from,to).reduce((sum,v)=>sum+v,0)/(to-from);
  if (power<10*Math.max(average(best-10,best-3),average(best+6,best+13)))return;
  const wave = x.subarray(Math.max(0, (left - 1) * hop), Math.min(x.length, (right + 3) * hop));
  return { wave, offsetMs: (best - middle) * 2, power };
}
function similar(a, b) {
  if (Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.65) return false;
  for (let offset = -24; offset <= 24; offset++) {
    let aa = 0,
      bb = 0,
      ab = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i],
        y = b[i + offset] ?? 0;
      aa += x * x;
      bb += y * y;
      ab += x * y;
    }
    if (Math.abs(ab) / Math.sqrt(aa * bb + 1e-30) > 0.93) return true;
  }
  return false;
}
