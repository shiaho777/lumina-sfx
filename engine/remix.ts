import { defaultSceneRole, sceneMoods } from './scene-mood.ts';
import type { SceneMood, SceneRole } from './scene-mood.ts';
import { measureLevel } from './levels.ts';
import { biquad, dbToGain } from './dsp.ts';
import { renderChannels } from './render.ts';
import { renderDurationSec, resolveMacros } from './sculpt.ts';
import type {
  DesignMacros,
  RenderContext,
  RenderOptions,
  ResolvedOptions,
  SoundParameter,
  SoundRecipe,
  SpectralExpectation,
} from './types.ts';

type Curve = readonly (readonly [number, number])[];

function validateCurve(points: Curve, duration: number, ceiling: number) {
  if (!Array.isArray(points)) throw Error('Expected envelope points');
  let previous = -1;
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2) throw Error('Use [seconds, value] envelope points');
    const [time, value] = point;
    if (
      !Number.isFinite(time) ||
      time <= previous ||
      time < 0 ||
      time > duration ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > ceiling
    )
      throw Error('Invalid envelope point');
    previous = time;
  }
}

// Each renderer traverses its automation once in chronological order.
function automation(points: Curve, power: boolean) {
  let segment = 0;
  return (time: number) => {
    while (segment + 1 < points.length && points[segment + 1][0] <= time) segment++;
    const [start, a] = points[segment];
    const next = points[segment + 1];
    if (!next || time <= start) return a;
    const fraction = (time - start) / (next[0] - start);
    const b = next[1];
    return power ? Math.sqrt(a * a + fraction * (b * b - a * a)) : a + fraction * (b - a);
  };
}

// Extend an ambience's source performance before applying movement and mix automation.
// Long or strongly retimed scenes use bounded renders with fresh deterministic takes.
function renderLayerAudio(recipe: SoundRecipe, opts: RenderOptions, rate: number, needed: number) {
  const nativeFrames = Math.round(renderDurationSec(recipe, opts.macros) * rate);
  if (!recipe.loopable || recipe.sustainMode !== 'evolving' || needed <= nativeFrames)
    return renderChannels(recipe, opts, rate);

  const speed = opts.macros?.speed ?? recipe.macros?.speed ?? 1;
  const maxFrames = Math.floor(48 * rate / Math.max(1, speed));
  const firstFrames = Math.min(needed, maxFrames);
  function take(frames: number, index: number) {
    const seed = ((opts.seed ?? 0) + Math.imul(index, 0x9e3779b9)) >>> 0;
    return renderChannels({ ...recipe, durationSec: frames * speed / rate }, { ...opts, seed }, rate);
  }
  const first = take(firstFrames, 0);
  if (needed === firstFrames) return first;

  const out = first.map(channel => {
    const samples = new Float32Array(needed);
    samples.set(channel);
    return samples;
  });
  const overlap = Math.min(Math.round(0.35 * rate), firstFrames >> 2);
  for (let end = firstFrames, index = 1; end < needed; index++) {
    const start = end - overlap;
    const frames = Math.min(maxFrames, needed - start);
    const next = take(frames, index);
    for (const [ch, source] of next.entries()) {
      const dst = out[ch];
      for (let i = 0; i < overlap; i++) {
        const angle = 0.5 * Math.PI * i / (overlap - 1);
        dst[start + i] = dst[start + i] * Math.cos(angle) + source[i] * Math.sin(angle);
      }
      dst.set(source.subarray(overlap), end);
    }
    end = start + frames;
  }
  return out;
}

export interface RemixLayer {
  recipe: SoundRecipe;
  role?: SceneRole;
  under?: { layer: number | string; byDb: number };
  paramsByMood?: Partial<Record<SceneMood, Readonly<Record<string, number>>>>;
  tune?: { sourceHz: number; intervalSemitones?: number };
  fromMarker?: string;
  label?: string;
  fitSec?: number;
  afterLayer?: { layer: number | string; shiftSec?: number; crossfadeSec?: number };
  atMarker?: { layer: number | string; name: string; shiftSec?: number };
  durationSec?: number;
  envelope?: Curve;
  muffle?: { cutoffHz: number; envelope: Curve };
  macros?: Readonly<DesignMacros>;
  gain?: number;
  offsetSec?: number;
  params?: Readonly<Record<string, number>>;
}
export const sceneStyles = {
  natural: {},
  cinematic: { size: 0.68, punch: 0.21, space: 'outdoor_open', wetness: 0.24 },
  arcade: { punch: 0.42, speed: 1.09, grit: 0.06 },
} as const;
export interface RemixDesign {
  mood?: SceneMood;
  tonicHz?: number;
  style?: keyof typeof sceneStyles;
  id: string;
  name?: string;
  spectrum?: readonly SpectralExpectation[];
  macros?: Readonly<DesignMacros>;
}

export interface TimedStem { index: number; offset: number; channels: Float32Array[] }
export interface SceneStage {
  output: 'mono'|'stereo'|'headphones';
  seed(index: number, base: number): number;
  finish(stems: TimedStem[], ctx: RenderContext, seed: number): Float32Array[];
}

export function composeRecipe(design: RemixDesign, layers: readonly RemixLayer[], stage?: SceneStage): SoundRecipe {
  return resolveRemix(design, layers, stage).recipe;
}

export function resolveRemix(design: RemixDesign, layers: readonly RemixLayer[], stage?: SceneStage) {
  if (typeof design.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(design.id))
    throw Error('Use a lowercase hyphenated remix ID');
  if (!layers.length || layers.length > (stage ? 32 : 4)) throw Error('A remix uses one to four layers');
  if (design.style !== undefined && !Object.hasOwn(sceneStyles, design.style)) throw Error('Unknown scene style');
  const mood = design.mood === undefined ? 'neutral' : design.mood;
  if (!Object.hasOwn(sceneMoods, mood)) throw Error('Unknown scene mood');
  if (design.tonicHz !== undefined && !(Number.isFinite(design.tonicHz) && design.tonicHz > 0))
    throw Error('tonicHz must be a positive frequency');
  const styling = design.style ? { ...sceneStyles[design.style], ...design.macros } : design.macros;
  resolveMacros(styling);
  for (const target of design.spectrum ?? []) {
    if (
      !['high', 'sub'].includes(target.band) ||
      !Number.isFinite(target.minShare) ||
      target.minShare < 0 ||
      target.minShare > 1
    ) {
      throw Error('Spectral targets require band high or sub and a minimum energy share in [0,1]');
    }
  }
  const params: Record<string, SoundParameter> = {};
  const first = layers[0].recipe;
  const paramKey = (index: number, key: string) => stage ? layers[index].label + '_' + key : (layers.length === 1 ? key : 'layer' + (index + 1) + '_' + key);
  const positions: { offset: number; start: number; speed: number; length: number }[] = [];
  const labels = new Map<string, number>();
  function earlierLayer(ref: string | number, index: number) {
    const n = typeof ref === 'string' ? labels.get(ref) : ref - 1;
    if (n === undefined || !Number.isInteger(n) || n < 0 || n >= index)
      throw Error('Anchor must reference an earlier layer');
    return n;
  }
  const referencedLevels = new Set<number>();
  const fades = layers.map(() => ({ incoming: 0, outgoing: 0 }));
  const tracks = layers.map(
    (
      {
        recipe,
        role = defaultSceneRole(recipe),
        under,
        paramsByMood,
        tune,
        macros,
        gain = 1,
        offsetSec,
        label,
        atMarker,
        afterLayer,
        fitSec,
        fromMarker,
        durationSec: span,
        envelope = [],
        muffle,
        params: overrides = {},
      },
      index,
    ) => {
      // An explicitly supporting wind bed can otherwise mask the listener's subject.
      // An authored gain (including unity) or an explicit level relationship takes precedence.
      if (!stage && under === undefined && layers[index].gain === undefined && layers[index].role === 'bed' && recipe.loopable &&
          recipe.tags.some(tag => tag === 'wind' || tag === 'breeze')) {
        const focus = layers.slice(0, index).findIndex(layer => layer.role === 'focus');
        if (focus >= 0) under = { layer: focus + 1, byDb: 16 };
      }
      let relativeTo: number | undefined;
      if (under !== undefined) {
        if (!under || !Number.isFinite(under.byDb) || under.byDb < 0 || under.byDb > 60)
          throw Error('under.byDb must be between 0 and 60');
        relativeTo = earlierLayer(under.layer, index);
        referencedLevels.add(relativeTo);
      }
      if (!Object.hasOwn(sceneMoods[mood], role)) throw Error('Unknown scene layer role');
      const [moodGain, cutoffHz] = sceneMoods[mood][role];
      if (mood === 'dramatic' && role !== 'bed' && (macros?.punch ?? recipe.macros?.punch) === undefined) {
        macros = { ...macros, punch: role === 'accent' ? 0.40 : 0.16 };
      }
      if (tune !== undefined) {
        const interval = tune?.intervalSemitones ?? 0;
        if (!design.tonicHz || !tune || !Number.isFinite(tune.sourceHz) || tune.sourceHz <= 0 ||
            !Number.isFinite(interval) || macros?.pitchShift !== undefined)
          throw Error('Tuning needs tonicHz, sourceHz and a finite interval without another pitch override');
        macros = { ...macros, pitchShift: 12 * Math.log2(design.tonicHz / tune.sourceHz) + interval };
      }
      if (label !== undefined) {
        if (typeof label !== 'string' || !/^[a-z][a-z0-9-]*$/.test(label) || /^layer[0-9]+$/.test(label) || labels.has(label))
          throw Error('Expected a unique lowercase layer label');
        labels.set(label, index);
      }
      if (atMarker !== undefined || afterLayer !== undefined) {
        if (offsetSec !== undefined || (atMarker !== undefined && afterLayer !== undefined))
          throw Error('Choose one earlier-layer anchor or an explicit offset');
        const anchor = atMarker ?? afterLayer;
        if (!anchor || typeof anchor !== 'object') throw Error('Invalid layer anchor');
        const source = earlierLayer(anchor.layer, index);
        const reference = positions[source];
        const shift = anchor.shiftSec ?? 0;
        if (!Number.isFinite(shift)) throw Error('Invalid anchor shift');
        let relative = reference.length;
        if (atMarker) {
          const marker = layers[source].recipe.markers?.[atMarker.name];
          if (typeof marker !== 'number' || !Number.isFinite(marker)) {
            const names = Object.keys(layers[source].recipe.markers ?? {});
            throw Error('Unknown anchor marker ' + atMarker.name + ' on layer ' + (source + 1) + ' referenced by layer ' + (index + 1) +
              (names.length ? '. Available markers: ' + names.join(', ') : '. That source has no markers'));
          }
          relative = marker / reference.speed - reference.start;
          if (relative < 0 || relative >= reference.length) throw Error('Anchor outside selected layer window');
        } else if (layers[source].recipe.loopable && layers[source].durationSec === undefined && layers[source].fitSec === undefined) {
          throw Error('Bound the loop before anchoring to its end');
        }
        if (afterLayer?.crossfadeSec !== undefined) {
          const seconds = afterLayer.crossfadeSec;
          if (afterLayer.shiftSec !== undefined || !Number.isFinite(seconds) || seconds <= 0 ||
              seconds + fades[source].incoming > reference.length + 1e-9 || fades[source].outgoing)
            throw Error('Invalid or overlapping crossfade on outgoing layer');
          fades[source].outgoing = seconds;
          fades[index].incoming = seconds;
          relative -= seconds;
        }
        offsetSec = reference.offset + relative + shift;
      }
      offsetSec ??= 0;
      if (!Number.isFinite(gain) || gain < 0 || gain > 4) throw Error('Layer gain must be in [0,4]');
      if (!Number.isFinite(offsetSec) || offsetSec < 0) throw Error('Expected non-negative layer offset');
      if (paramsByMood !== undefined && (!paramsByMood || typeof paramsByMood !== 'object' || Array.isArray(paramsByMood)))
        throw Error('Invalid mood parameter groups');
      for (const preset of Object.keys(paramsByMood ?? {})) {
        if (!Object.hasOwn(sceneMoods, preset)) throw Error('Unknown mood parameter group');
      }
      for (const settings of [overrides, ...Object.values(paramsByMood ?? {})]) {
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw Error('Invalid layer parameters');
        for (const [key, value] of Object.entries(settings)) {
          const spec = Object.hasOwn(recipe.params, key) && recipe.params[key];
          if (!spec || !Number.isFinite(value) || value < spec.min || value > spec.max)
            throw Error(recipe.id + ': unknown or out-of-range DSP parameter ' + key);
        }
      }
      overrides = { ...overrides, ...paramsByMood?.[mood] };
      for (const [key, spec] of Object.entries(recipe.params)) {
        params[paramKey(index, key)] = { ...spec, default: overrides[key] ?? spec.default };
      }
      resolveMacros(macros);
      const marker = fromMarker === undefined ? 0 : recipe.markers?.[fromMarker];
      if (typeof marker !== 'number' || !Number.isFinite(marker) || marker < 0 || marker >= recipe.durationSec)
        throw Error(recipe.id + ': invalid source marker ' + fromMarker);
      if (fitSec !== undefined) {
        if (!Number.isFinite(fitSec) || fitSec <= 0 || span !== undefined || macros?.speed !== undefined)
          throw Error('Use a positive fitSec without durationSec or an explicit speed');
        const tail = renderDurationSec(recipe, { ...macros, speed: 1 }) - recipe.durationSec;
        const fittedSpeed = (recipe.durationSec - marker) / (fitSec - tail);
        if (!(fittedSpeed >= 0.25 && fittedSpeed <= 4))
          throw Error('fitSec exceeds the available stretch range including the room tail');
        macros = { ...macros, speed: fittedSpeed };
        span = fitSec;
      }
      const speed = macros?.speed ?? recipe.macros?.speed ?? 1;
      const start = marker / speed;
      const remaining = renderDurationSec(recipe, macros) - start;
      if (
        span !== undefined &&
        (!Number.isFinite(span) || span <= 0 || (!recipe.loopable && span > remaining + 1e-8))
      )
        throw Error(recipe.id + ': invalid layer duration');
      const length = span ?? remaining;
      if (fades[index].incoming > length + 1e-9)
        throw Error('Crossfade exceeds incoming layer duration');
      positions.push({ offset: offsetSec, start, speed, length });
      const limit = recipe.loopable && span === undefined ? 120 : length;
      validateCurve(envelope, limit, 4);
      if (muffle !== undefined) {
        if (
          !muffle ||
          !Number.isFinite(muffle.cutoffHz) ||
          muffle.cutoffHz < 40 ||
          muffle.cutoffHz > 20000 ||
          !muffle.envelope?.length
        )
          throw Error('Invalid muffle filter or envelope');
        validateCurve(muffle.envelope, limit, 1);
      }
      return { recipe, relativeTo, byDb: under?.byDb ?? 0, gain: gain * moodGain, cutoffHz, offsetSec, macros, start, length, span, envelope, muffle };
    },
  );
  if (
    !stage && !tracks.some(
      (t) => t.gain > 0 && t.offsetSec === 0 && (!t.envelope.length || t.envelope.some((point) => point[1] > 0)),
    )
  )
    throw Error('Start one audible layer at offset zero');
  const durationSec = Math.max(...tracks.map((t) => t.offsetSec + t.length));
  const loopable = !stage && tracks.every((t) => t.recipe.loopable && t.offsetSec === 0 && t.span === undefined);
  const credits = tracks
    .flatMap((t) => [t.recipe.recording, ...(t.recipe.additionalRecordings ?? [])])
    .filter((c) => c !== undefined);
  const unique = [...new Map(credits.map((c) => [c.url, c])).values()];
  const stereo = stage ? stage.output !== 'mono' : tracks.some((t) => Boolean(t.recipe.renderStereo));

  function mix(ctx: RenderContext, opts: ResolvedOptions, stereoOut: boolean) {
    if(stage && tracks.reduce((sum,t)=>sum+(t.recipe.loopable && t.span===undefined ? ctx.frames : Math.min(ctx.frames,Math.round(ctx.sampleRate*t.length))),0)>16000000)
      throw Error('Scene exceeds 16 million source frames; render in shorter sections or use fewer simultaneous stems');
    const output = Array.from({ length: stereoOut ? 2 : 1 }, () => new Float32Array(ctx.frames));
    const stems: TimedStem[] = [];
    const activeLevels = new Map<number, number>();
    for (const [index, track] of tracks.entries()) {
      if (!track.gain && !stage) continue;
      const controls = Object.fromEntries(
        Object.keys(track.recipe.params).map((key) => [key, opts.params[paramKey(index, key)]]),
      );
      const offset = Math.round(track.offsetSec * ctx.sampleRate);
      const start = Math.round(track.start * ctx.sampleRate);
      const frames =
        track.recipe.loopable && track.span === undefined ? ctx.frames : Math.round(track.length * ctx.sampleRate);
      const length = Math.min(frames, ctx.frames - offset);
      const audio = renderLayerAudio(
        track.recipe,
        { seed: stage ? stage.seed(index, opts.seed) : (opts.seed + index * 8191) >>> 0, params: controls, macros: track.macros },
        ctx.sampleRate,
        start + length,
      );
      // Meter just the rendered stem window, including automation and the actual source take.
      const metered = referencedLevels.has(index) || track.relativeTo !== undefined;
      const target = stage ? [new Float32Array(length), new Float32Array(length)] : metered ? output.map(() => new Float32Array(length)) : output;
      const destOffset = stage || metered ? 0 : offset;
      const gainCurve = track.envelope.length ? automation(track.envelope, true) : undefined;
      const wetCurve = track.muffle && automation(track.muffle.envelope, false);
      const filters =
        track.muffle &&
        audio.map(() =>
          biquad('lowpass', Math.min(ctx.sampleRate * 0.45, track.muffle!.cutoffHz), 0.707, ctx.sampleRate),
        );
      const toneFilters = track.cutoffHz ? audio.map(() =>
        biquad('lowpass', Math.min(ctx.sampleRate * 0.45, track.cutoffHz), 0.707, ctx.sampleRate)) : undefined;
      const fadeIn = Math.round(fades[index].incoming * ctx.sampleRate);
      const fadeOut = Math.round(fades[index].outgoing * ctx.sampleRate);
      const edge = Math.max(1, Math.round(ctx.sampleRate * 0.003));
      for (let i = 0; i < length; i++) {
        const frame = (start + i) % audio[0].length;
        if (!track.recipe.loopable && start + i >= audio[0].length) break;
        const time = i / ctx.sampleRate;
        let gain = track.gain * (gainCurve ? gainCurve(time) : 1);
        let left = audio[0][frame];
        let right = (audio[1] ?? audio[0])[frame];
        if (filters && wetCurve) {
          const wet = wetCurve(time);
          left += wet * (filters[0](left) - left);
          right = filters[1] ? right + wet * (filters[1](right) - right) : left;
        }
        if (toneFilters) {
          left = toneFilters[0](left);
          right = toneFilters[1] ? toneFilters[1](right) : left;
        }
        if (i < fadeIn) gain *= Math.sin(Math.PI * 0.5 * i / fadeIn);
        if (fadeOut && i >= length - fadeOut) gain *= Math.sin(Math.PI * 0.5 * (length - i) / fadeOut);
        if (start) gain *= Math.min(1, i / edge);
        if (track.span !== undefined) gain *= Math.min(1, (length - 1 - i) / edge);
        if (stereoOut || stage) {
          target[0][destOffset + i] += gain * left;
          target[1][destOffset + i] += gain * right;
        } else {
          const mono = audio.length === 1 ? left : (left + right) * 0.5;
          target[0][destOffset + i] += gain * mono;
        }
      }
      if (metered) {
        const level = Math.max(...target.map(channel => measureLevel(channel, ctx.sampleRate).activeDb));
        const reference = track.relativeTo === undefined ? Infinity : activeLevels.get(track.relativeTo) ?? -Infinity;
        const trimDb = Math.min(0, reference - track.byDb - level);
        activeLevels.set(index, level + trimDb);
        const trim = dbToGain(trimDb);
        for (let ch = 0; ch < target.length; ch++) {
          for (let i = 0; i < length; i++) {
            if (stage) target[ch][i] *= trim;
            else output[ch][offset + i] += target[ch][i] * trim;
          }
        }
      }
      if (stage) stems.push({index, offset, channels:target});
    }
    if (stage) {
      const mix = stage.finish(stems,ctx,opts.seed);
      if (!stereoOut && mix.length===2) return [mix[0].map((v,i)=>(v+mix[1][i])*.5)];
      return mix;
    }
    return output;
  }

  // Keep sync points addressable when this mix becomes a layer in another design.
  const markers: Record<string, number> = {};
  for (const [index, track] of tracks.entries()) {
    for (const [name, sourceTime] of Object.entries(track.recipe.markers ?? {})) {
      const relative = sourceTime / positions[index].speed - track.start;
      if (relative >= 0 && relative < track.length) {
        markers['layer' + (index + 1) + '.' + name] = track.offsetSec + relative;
        if (layers[index].label) markers[layers[index].label + '.' + name] = track.offsetSec + relative;
      }
    }
  }
  const result: SoundRecipe = {
    isolation: tracks.every(track => track.recipe.isolation === 'isolated') ? 'isolated' : undefined,
    markers,
    id: design.id,
    name: design.name ?? design.id,
    category: first.category,
    mixRole: first.mixRole,
    tags: [...new Set(['remix', ...first.tags, ...tracks.slice(1).map((t) => t.recipe.id)])],
    loopable,
    immediateOnset: !stage && !loopable,
    preserveTimeline: stage ? true : undefined,
    durationSec,
    spectrum: design.spectrum ?? (stage ? undefined : first.spectrum),
    params,
    macros: styling,
    targetRmsDbfs: first.targetRmsDbfs,
    recording: unique[0],
    additionalRecordings: unique.slice(1),
    render: (ctx, opts) => mix(ctx, opts, false)[0],
    renderStereo: stereo
      ? (ctx, opts) => {
          const [left, right] = mix(ctx, opts, true);
          return [left, right];
        }
      : undefined,
  };
  const outputDurationSec = renderDurationSec(result);
  if (durationSec > 120 || outputDurationSec > 120 || outputDurationSec < 0.01)
    throw Error('Remix duration must be 0.01 to 120 seconds');
  return {
    recipe: result,
    layout: () => ({
      id: design.id, durationSec, outputDurationSec, loopable, mood, markers,
      layers: tracks.map((track, index) => {
        const repeats = track.recipe.loopable && track.span === undefined;
        return {
          layer: index + 1, id: track.recipe.id, label: layers[index].label,
          offsetSec: track.offsetSec, endSec: repeats ? durationSec : track.offsetSec + track.length,
          sourceStartSec: track.start, speed: positions[index].speed, repeats,
          gain: track.gain, under: track.relativeTo === undefined ? undefined : { layer: track.relativeTo + 1, byDb: track.byDb },
          ...(fades[index].incoming ? { fadeInSec: fades[index].incoming } : {}),
          ...(fades[index].outgoing ? { fadeOutSec: fades[index].outgoing } : {}),
          controls: Object.fromEntries(Object.keys(track.recipe.params).map(key => [key, params[paramKey(index, key)]])),
        };
      }),
    }),
  };
}
