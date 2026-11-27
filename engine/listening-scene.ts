// Scene time is in seconds. The focus policy only changes gain; movement belongs to placement.
import {monitorFocus, type FocusMonitor} from './focus-monitor.ts';
import { biquad } from './dsp.ts';
import { resolveRemix, sceneStyles } from './remix.ts';
import type { RemixDesign, RemixLayer, TimedStem } from './remix.ts';
import { resolveEmitter, type Acoustics, type Arrival } from './acoustic-emitter.ts';
import { bounded, placeAudio, validatePlacement, validateTrajectory } from './spatial.ts';
import type { HeadResponse, OutputMode, Placement, Trajectory } from './spatial.ts';
import { resolveMacros } from './sculpt.ts';
import type { SoundRecipe } from './types.ts';

export interface Focus {
  subjects: readonly string[];
  marginDb?: number;
  timing?: 'steady' | 'local';
}
export interface Moment extends Focus {
  from: number;
  to: number;
}
export interface ListeningDesign extends RemixDesign {
  schemaVersion: 2;
  viewpoint?: string;
  balance?: 'natural'|'directed';
  scope?: 'world'|'mixed';
  sourcePolicy?: 'clean'|'field';
  listener?: Trajectory;
  output?: OutputMode;
  focus?: Focus & { moments?: readonly Moment[] };
}
export interface ListeningLayer extends RemixLayer {
  acoustics?:Acoustics;
  event?:string;
  placement?: Placement;
  locked?: boolean;
  maskEq?: { hz: number; cutDb: number; q?: number };
}
export interface Stem {
  label: string;
  source: string;
  placement: Placement;
  locked: boolean;
  offset: number;
  event?:string;
  components?:readonly string[];
  arrival?:Arrival;
  dry: Float32Array[];
  ears: Float32Array[];
}
export interface Region {
  from: number;
  to: number;
  subjects: readonly string[];
  marginDb: number | null;
  gain: Record<string, number>;
  measuredBeforeDb: number | null;
  measuredAfterDb: number | null;
  worstTimeSec: number | null;
  overlapWindows: number;
  transientWindows: number;
  conflicts: string[];
  monitors?: FocusMonitor;
  delivered?: {
    activeWindows: number;
    focusDbfs: number;
    backgroundDbfs: number;
    marginDb: number;
    phoneMarginDb: number | null;
    worstTimeSec: number;
  };
}
export interface SceneInspection {
  balance:'natural'|'directed';
  masterGain: number;
  rate: number;
  seed: number;
  output: OutputMode;
  listener: Trajectory;
  viewpoint?: string;
  regions: Region[];
  stems: Stem[];
  frames: number;
}
export type InspectScene = (result: SceneInspection) => void;
export function layerSeed(label: string, base: number) {
  let hash = 2166136261;
  for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619);
  return (hash + base) >>> 0;
}
const levelDb = (power: number) => 10 * Math.log10(Math.max(1e-16, power));
function quantile(values: number[], fraction: number) {
  return values.sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
}
function powerAt(stem: Stem, start: number, end: number) {
  let energy = 0;
  for (let i = Math.max(0, start - stem.offset); i < Math.min(end - stem.offset, stem.ears[0].length); i++)
    for (const c of stem.ears) energy += c[i] * c[i];
  return energy / ((end - start) * stem.ears.length);
}
interface WindowPower {
  start: number;
  focus: number;
  bed: number;
  locked: number;
  cross: number;
}
function bedPower(w: WindowPower, trim: number) {
  return Math.max(0, w.locked + 2 * w.cross * trim + w.bed * trim * trim);
}
// Identify isolated foreground masking on the original performance. Fixed lead and
// recovery time keep the gain stable through a burst or group of closely spaced hits.
function maskingCuts(active: WindowPower[], trims: number[], from: number, to: number) {
  if (to - from < 2 || active.length < 20) return [];
  const typical = quantile([...trims], 0.5);
  const spans: { start: number; end: number }[] = [];
  for (let i = 0; i < active.length; i++) {
    if (trims[i] >= typical * 0.63 || trims[i] >= 0.71) continue;
    const w = active[i];
    const previous = spans.at(-1);
    if (previous && w.start - previous.end < 0.55) previous.end = w.start + 0.05;
    else spans.push({ start: w.start, end: w.start + 0.05 });
  }
  const bursts = spans.filter(s => s.end - s.start >= 0.09);
  if (bursts.reduce((sum, s) => sum + s.end - s.start, 0) > (to - from) * 0.4) return [];
  const cuts = [];
  for (const s of bursts) {
    if (s.start - from > 0.25) cuts.push(s.start - 0.12);
    if (to - s.end > 0.25) cuts.push(s.end + 0.12);
  }
  return cuts;
}
function measure(stems: Stem[], spec: Moment, rate: number, cuts?: number[], prior?: Region): Region {
  const { from, to, subjects } = spec,
    marginDb = spec.marginDb ?? 8;
  const gain: Record<string, number> = Object.create(null);
  for (const s of stems) gain[s.label] = prior && subjects.includes(s.label) ? prior.gain[s.label] : 1;
  const result: Region = {
    from,
    to,
    subjects,
    marginDb,
    gain,
    measuredBeforeDb: null,
    measuredAfterDb: null,
    worstTimeSec: null,
    overlapWindows: 0,
    transientWindows: 0,
    conflicts: [],
  };
  if (!subjects.length) return result;
  const foreground = stems.filter((s) => subjects.includes(s.label));
  const start = Math.round(from * rate),
    end = Math.round(to * rate),
    hop = Math.max(1, Math.round(rate * 0.05));
  const windows: (readonly [number, number])[] = [];
  for (let t = start; t < end; t += hop) windows.push([t, Math.min(t + hop, end)] as const);
  if (foreground.length > 1 && !prior) {
    // Shared subjects are matched on overlapping active windows only. A silent subject
    // never drags the rest of the scene down. Locked reference levels are authoritative.
    const levels = foreground.map((s) => windows.map(([a, b]) => powerAt(s, a, b)));
    const peaks = levels.map((xs) => xs.reduce((a, b) => Math.max(a, b), 0));
    const jointlyActive = windows.map((_, i) =>
      levels.every((xs, k) => xs[i] > Math.max(1e-12, peaks[k] * 0.01)),
    );
    const typical = levels.map((xs) =>
      quantile(
        xs.filter((_, i) => jointlyActive[i]),
        0.5,
      ),
    );
    if (typical.every(Number.isFinite)) {
      const fixed = typical.filter((_, i) => foreground[i].locked);
      const target = Math.min(...(fixed.length ? fixed : typical));
      foreground.forEach((s, i) => {
        if (!s.locked) gain[s.label] = Math.min(1, Math.sqrt(target / typical[i]));
      });
      if (
        fixed.length &&
        typical.some((v, i) => Math.abs(levelDb((v * gain[foreground[i].label] ** 2) / target)) > 2)
      )
        result.conflicts.push('Shared subjects cannot be equally present with the locked levels.');
    }
  }
  const measured: WindowPower[] = [];
  const n = stems[0].ears.length;
  for (const [a, b] of windows) {
    const buses = Array.from({ length: 3 * n }, () => new Float32Array(b - a));
    for (const s of stems) {
      const bus = subjects.includes(s.label) ? 0 : s.locked ? 1 : 2;
      const lo = Math.max(0, s.offset - a),
        hi = Math.min(b - a, s.offset - a + s.ears[0].length);
      for (let ch = 0; ch < n; ch++) {
        const dest = buses[bus * n + ch],
          src = s.ears[ch],
          g = gain[s.label];
        for (let j = lo; j < hi; j++) dest[j] += src[a + j - s.offset] * g;
      }
    }
    let focus = 0,
      bed = 0,
      locked = 0,
      cross = 0;
    for (let ch = 0; ch < n; ch++)
      for (let j = 0; j < b - a; j++) {
        const f = buses[ch][j],
          l = buses[n + ch][j],
          u = buses[2 * n + ch][j];
        focus += f * f;
        locked += l * l;
        bed += u * u;
        cross += l * u;
      }
    const frames = (b - a) * n;
    measured.push({
      start: a / rate,
      focus: focus / frames,
      bed: bed / frames,
      locked: locked / frames,
      cross: cross / frames,
    });
  }
  const max = measured.reduce((m, w) => Math.max(m, w.focus), 0);
  const active = measured.filter((w) => w.focus > Math.max(1e-12, max * 0.008) && bedPower(w, 1) > 1e-12);
  result.overlapWindows = active.length;
  if (!active.length) return result;
  const requested = 10 ** (-marginDb / 10);
  // Solve the power of the actual summed, possibly correlated, adjustable and locked beds.
  // A steady trim per authored region keeps ambience from pumping between short contacts.
  const trims = active.map((w) => {
    if (bedPower(w, 1) <= w.focus * requested) return 1;
    const d = w.cross * w.cross + w.bed * (w.focus * requested - w.locked);
    return d < 0 || w.bed < 1e-16 ? 0 : Math.min(1, Math.max(0, (-w.cross + Math.sqrt(d)) / w.bed));
  });
  if (cuts) cuts.push(...maskingCuts(active, trims, from, to));
  const trim = Math.max(10 ** (-30 / 20), quantile(trims, 0.05));
  for (const s of stems) if (!subjects.includes(s.label) && !s.locked) gain[s.label] = trim;
  const gap = (w: WindowPower, g: number) => levelDb(w.focus) - levelDb(bedPower(w, g));
  const worst = active.reduce((a, b) => (gap(a, trim) < gap(b, trim) ? a : b));
  result.measuredBeforeDb = quantile(
    active.map((w) => gap(w, 1)),
    0.05,
  );
  result.measuredAfterDb = quantile(
    active.map((w) => gap(w, trim)),
    0.05,
  );
  result.worstTimeSec = worst.start;
  result.transientWindows = active.filter((w) => gap(w, trim) < marginDb - 1).length;
  if (result.measuredAfterDb < marginDb - 0.25)
    result.conflicts.push('Requested margin exceeds the available trim or a background level is locked.');
  return result;
}
// Audit the actual handoff ramps and the mono phone band. Gating uses the subject's
// local peak, so a quiet but recognisable distant source still gets evaluated.
function auditRegion(stems: Stem[], regions: Region[], k: number, rate: number) {
  const r = regions[k];
  if (!r.subjects.length) return;
  const hop = Math.round(0.05 * rate),
    start = Math.round(r.from * rate),
    end = Math.round(r.to * rate);
  const windows = [];
  const hp = 1 - Math.exp((-2 * Math.PI * 280) / rate),
    lp = 1 - Math.exp((-2 * Math.PI * 3800) / rate);
  const low = [0, 0],
    high = [0, 0];
  for (let a = start; a < end; a += hop) {
    const n = Math.min(hop, end - a),
      sides = stems[0].ears.length;
    const bus = Array.from({ length: 2 * sides }, () => new Float32Array(n));
    for (const s of stems) {
      const role = r.subjects.includes(s.label) ? 0 : 1;
      const lo = Math.max(0, s.offset - a),
        hi = Math.min(n, s.ears[0].length + s.offset - a);
      for (let j = lo; j < hi; j++) {
        const t = (a + j) / rate,
          g = k && t - r.from < 0.1 ? regionGain(regions, k, t, s.label) : r.gain[s.label];
        for (let ch = 0; ch < sides; ch++) bus[role * sides + ch][j] += s.ears[ch][a + j - s.offset] * g;
      }
    }
    const power = [0, 0],
      phone = [0, 0];
    for (let role = 0; role < 2; role++)
      for (let j = 0; j < n; j++) {
        let mono = 0;
        for (let c = 0; c < sides; c++) {
          const x = bus[role * sides + c][j];
          power[role] += (x * x) / sides;
          mono += x / sides;
        }
        low[role] += hp * (mono - low[role]);
        high[role] += lp * (mono - low[role] - high[role]);
        phone[role] += high[role] ** 2;
      }
    windows.push({ t: a / rate, f: power[0] / n, b: power[1] / n, pf: phone[0] / n, pb: phone[1] / n });
  }
  const peak = windows.reduce((p, w) => Math.max(p, w.f), 0);
  if (peak <= 1e-12) {
    r.conflicts.push('No audible focus signal in this region at the listener.');
    return;
  }
  const active = windows.filter((w) => w.f > peak * 0.008 && w.b > 1e-12);
  if (!active.length) return;
  const gap = (f: number, b: number) => levelDb(f) - levelDb(b);
  const worst = active.reduce((a, b) => (gap(a.f, a.b) < gap(b.f, b.b) ? a : b));
  const phones = active.filter((w) => w.pb > 1e-12).map((w) => gap(w.pf, w.pb));
  if(r.marginDb === null){
    r.overlapWindows=active.length;
    r.measuredBeforeDb=r.measuredAfterDb=quantile(active.map(w=>gap(w.f,w.b)),.05);
    r.worstTimeSec=worst.t;
  }
  r.measuredAfterDb=quantile(active.map(w=>gap(w.f,w.b)),.05);
  r.delivered = {
    activeWindows: active.length,
    focusDbfs: levelDb(worst.f),
    backgroundDbfs: levelDb(worst.b),
    marginDb: quantile(
      active.map((w) => gap(w.f, w.b)),
      0.05,
    ),
    phoneMarginDb: phones.length ? quantile(phones, 0.05) : null,
    worstTimeSec: worst.t,
  };
}
// Crossfade only at deliberate handoffs. Gain stays constant between them.
export function regionGain(regions: Region[], index: number, time: number, label: string) {
  const current = regions[index];
  const ease = Math.min(0.1, (current.to - current.from) / 2);
  const u = Math.min(1, Math.max(0, (time - current.from) / ease));
  const prev = index ? regions[index - 1].gain[label] : current.gain[label];
  return prev + (current.gain[label] - prev) * (0.5 - 0.5 * Math.cos(Math.PI * u));
}
export function composeListeningScene(
  design: ListeningDesign,
  layers: readonly ListeningLayer[],
  head?: HeadResponse,
  inspect?: InspectScene,
): SoundRecipe {
  return resolveListeningScene(design, layers, head, inspect).recipe;
}

export function resolveListeningScene(
  design: ListeningDesign,
  layers: readonly ListeningLayer[],
  head?: HeadResponse,
  inspect?: InspectScene,
) {
  if (design.schemaVersion !== 2) throw Error('Expected listening scene version 2');
  const output = design.output ?? 'stereo',
    listener = design.listener ?? { position: [0, 0, 0] as const };
  if (!['stereo', 'mono', 'headphones'].includes(output)) throw Error('Unknown scene output');
  if (output === 'headphones' && !head)
    throw Error('Headphone output requires the measured headphone filter');
  validateTrajectory(listener);
  if (design.style !== undefined && !Object.hasOwn(sceneStyles, design.style))
    throw Error('Unknown scene style');
  const palette = { ...(design.style ? sceneStyles[design.style] : {}), ...design.macros };
  resolveMacros(palette);
  const balance=design.balance??(design.focus?.marginDb!==undefined || design.focus?.moments?.length?'directed':'natural');
  if(!['natural','directed'].includes(balance))throw Error('Unknown scene balance');
  if(!['mixed','world'].includes(design.scope??'mixed'))throw Error('Unknown scene scope');
  if(!['clean','field'].includes(design.sourcePolicy??'field'))throw Error('Unknown source policy');
  const named = layers.map((l) => ({
    ...l,
    ...resolveEmitter(l,listener),
    macros: { ...palette, ...l.macros },
    label:
      l.label ??
      (/^[a-z]/.test(l.recipe.id) && !/^layer[0-9]+$/.test(l.recipe.id)
        ? l.recipe.id
        : 'source-' + l.recipe.id),
  }));
  const labels = new Set(named.map((l) => l.label));
  if (labels.size !== layers.length) throw Error('Repeated sources need unique labels');
  for (const l of named) {
    if(l.event!==undefined && (typeof l.event!=='string' || !/^[a-z][a-z0-9-]*$/.test(l.event)))throw Error('Invalid physical event identity');
    if(design.sourcePolicy==='clean' && l.recipe.isolation!=='isolated')throw Error('Clean scene needs an isolated source: '+l.recipe.id);
    const locatedInput = l.recipe.tags.includes('launch') && l.recipe.tags.some(t=>t==='keyboard' || t==='device') &&
      l.placement !== undefined && l.placement.kind!=='listener';
    if(design.scope==='world' && !locatedInput && (l.recipe.mixRole==='interface' || l.recipe.tags.some(t=>['menu','cursor'].includes(t))))
      throw Error('World scene contains an interface cue: '+l.recipe.id);
    if (l.maskEq) {
      bounded(l.maskEq.hz, 50, 12000, 'maskEq centre frequency');
      bounded(l.maskEq.cutDb, 0, 9, 'maskEq cutDb');
      bounded(l.maskEq.q ?? 0.9, 0.3, 4, 'maskEq Q');
    }
    validatePlacement(l.placement ?? { kind: 'listener' });
    if (l.locked !== undefined && typeof l.locked !== 'boolean') throw Error('locked must be boolean');
  }
  const focus = design.focus ?? { subjects: named.filter((s) => s.role === 'focus').map((s) => s.label) };
  function validateFocus(f: Focus) {
    if (
      !Array.isArray(f.subjects) ||
      new Set(f.subjects).size !== f.subjects.length ||
      f.subjects.some((s) => !labels.has(s))
    )
      throw Error('Focus subjects must name distinct scene layers');
    if (f.timing !== undefined && !['steady', 'local'].includes(f.timing)) throw Error('Choose steady or local focus timing');
    bounded(f.marginDb ?? 8, 0, 30, 'focus marginDb');
  }
  validateFocus(focus);
  const moments = focus.moments ?? [];
  if(balance==='natural' && (moments.length || focus.marginDb!==undefined)) throw Error('An explicit focus margin or handoff uses directed balance');
  let last = 0;
  for (const m of moments) {
    validateFocus(m);
    bounded(m.from, last, 120, 'moment start');
    bounded(m.to, m.from, 120, 'moment end');
    if (m.from === m.to) throw Error('A focus moment needs a duration');
    last = m.to;
  }
  const scene = resolveRemix({ ...design, style: undefined, macros: undefined }, named, {
    output,
    seed: (i, base) => layerSeed(named[i].label, base),
    finish(dry: TimedStem[], ctx, seed) {
      const { frames, sampleRate: rate } = ctx;
      const stems: Stem[] = dry
        .map(({ index, offset, channels }) => {
          const l = named[index],
            placement = l.placement ?? { kind: 'listener' as const };
          if(l.arrival && l.arrival.sourceTrimDb!==0){
            const strength=10**(l.arrival.sourceTrimDb/20);
            channels=channels.map(channel=>channel.map(x=>x*strength));
          }
          if (l.maskEq && l.maskEq.cutDb > 0) {
            const cut = 1 - 10 ** (-l.maskEq.cutDb / 20);
            channels = channels.map((c) => {
              const band = biquad('bandpass', l.maskEq!.hz, l.maskEq!.q ?? 0.9, rate);
              return c.map((x) => x - cut * band(x));
            });
          }
          return {
            label: l.label,
            source: l.recipe.id,
            event:l.event, components:l.recipe.components, arrival:l.arrival,
            placement,
            locked: l.locked ?? false,
            offset,
            dry: channels,
            ears: placeAudio(
              channels,
              placement,
              listener,
              output,
              rate,
              offset / rate,
              output === 'headphones' ? head : undefined,
            ),
          };
        })
        .sort((a, b) => (a.label < b.label ? -1 : 1));
      if(design.scope==='world' || balance==='natural' || design.sourcePolicy==='clean'){
        for(let i=0;i<stems.length;i++) for(const b of stems.slice(i+1)){
          const a=stems[i];
          if(a.offset+a.dry[0].length<=b.offset || b.offset+b.dry[0].length<=a.offset)continue;
          if(a.event && b.event && a.event!==b.event)continue;
          const shared=a.components?.some(c=>b.components?.includes(c));
          const repeated=a.source===b.source;
          if((a.event && a.event===b.event && (shared || a.source===b.source)) ||
            ((!a.event || !b.event) && (repeated || shared)))
            throw Error('Overlapping copies of '+a.label+' and '+b.label+'; choose a single performance or identify distinct physical emitters');
        }
      }
      const regions: Region[] = [];
      function addRegion(spec: Moment) {
        if (balance === 'natural') {
          const region = measure(stems, { ...spec, subjects: [] }, rate);
          regions.push({ ...region, subjects: spec.subjects, marginDb: null });
          return;
        }
        const cuts: number[] = [];
        const whole = measure(stems, spec, rate, spec.timing === 'local' ? cuts : undefined);
        if (!cuts.length) { regions.push(whole); return; }
        let from = spec.from;
        for (const to of [...cuts, spec.to]) {
          regions.push(measure(stems, { ...spec, from, to }, rate, undefined, whole));
          from = to;
        }
      }
      let t = 0;
      for (const m of moments) {
        if (m.from > t) addRegion({ ...focus, from: t, to: m.from });
        addRegion({ ...m, timing: m.timing ?? focus.timing, marginDb: m.marginDb ?? focus.marginDb });
        t = m.to;
      }
      if (t < frames / rate) addRegion({ ...focus, from: t, to: frames / rate });
      for(const r of regions){
        if(r.marginDb!==null || inspect)r.monitors=monitorFocus(stems,r,rate,r.marginDb!==null);
      }
      const mix = Array.from({ length: output === 'mono' ? 1 : 2 }, () => new Float32Array(frames));
      for (const s of stems) {
        for (const [k, r] of regions.entries()) {
          const from = Math.max(s.offset, Math.round(r.from * rate)),
            to = Math.min(s.offset + s.ears[0].length, Math.round(r.to * rate));
          if (from >= to) continue;
          // A source can start after this region's handoff ramp has already finished.
          const transitionEnd = k ? Math.max(from, Math.min(to, Math.ceil((r.from + 0.1) * rate))) : from;
          for (let ch = 0; ch < mix.length; ch++) {
            const src = s.ears[ch],
              out = mix[ch];
            for (let i = from; i < transitionEnd; i++)
              out[i] += src[i - s.offset] * regionGain(regions, k, i / rate, s.label);
            for (let i = transitionEnd; i < to; i++) out[i] += src[i - s.offset] * r.gain[s.label];
          }
        }
      }
      if (inspect) {
        regions.forEach((r,i)=>{
          auditRegion(stems,regions,i,rate);
          if(i && r.monitors && stems.some(s=>regions[i-1].gain[s.label]!==r.gain[s.label])){
            const audible=monitorFocus(stems,r,rate,false,(label,time)=>regionGain(regions,i,time,label));
            if(audible){r.monitors.planned=r.monitors.views;r.monitors.views=audible.views;}
          }
        });
        let peak = 0;
        for (const channel of mix) for (const x of channel) peak = Math.max(peak, Math.abs(x));
        const masterGain = Math.min(1, 10 ** (-0.58 / 20) / Math.max(peak, 1e-12));
        const trimDb = 20 * Math.log10(masterGain);
        for (const r of regions)
          if (r.delivered) {
            r.delivered.focusDbfs += trimDb;
            r.delivered.backgroundDbfs += trimDb;
          }
        inspect({
          balance,masterGain,
          rate,
          seed,
          output,
          listener,
          viewpoint: design.viewpoint,
          regions,
          stems,
          frames,
        });
      }
      return mix;
    },
  });
  if (last > scene.recipe.durationSec) throw Error('Focus moment extends beyond the scene');
  return scene;
}
