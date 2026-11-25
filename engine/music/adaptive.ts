export const transitionPoints = ['now', 'beat', 'bar', 'end'] as const;
export const entryPoints = ['start', 'phase', 'harmonic'] as const;

export interface MusicTransition {
  at: typeof transitionPoints[number];
  entry: typeof entryPoints[number];
  fadeBeats: number;
  waitBars?: number;
}

interface ClipHarmony {
  chord: string;
  bass: number;
  mask: number;
}

export interface AdaptiveClip {
  beats: number;
  frames: number;
  file: string;
  harmony?: ClipHarmony[];
}

export interface MusicIntensityBand {
  min: number;
  state: string;
}

export interface AdaptiveMusicBank {
  version: 1;
  id: string;
  bpm: number;
  beatsPerBar: number;
  sampleRate: number;
  initial: string;
  clips: Readonly<Record<string, AdaptiveClip>>;
  states: Readonly<Record<string, string>>;
  oneShot: readonly string[];
  defaults: MusicTransition;
  transitions: readonly (MusicTransition & { from: string; to: string })[];
  intensity: readonly MusicIntensityBand[];
  hysteresis: number;
}

export interface MusicStart {
  state: string;
  section: string;
  beat: number;
  offsetBeat: number;
  fadeBeats: number;
  reason: 'initial' | 'repeat' | 'transition';
  handoff?: { mode: 'phase' | 'match' | 'release'; from?: string; to?: string; shared?: true };
}

export type MusicChange = Partial<MusicTransition> & { beat: number } &
  ({ state: string; intensity?: never } | { intensity: number; state?: never });

const epsilon = 1e-7;

export function musicObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error(path + ' must be an object');
  return value as Record<string, unknown>;
}

export function musicNumber(value: unknown, path: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) throw Error(path + ' must be ' + (integer ? 'an integer' : 'a number') + ' from ' + min + ' to ' + max);
  return value;
}

export function musicId(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value)) throw Error(path + ' must be a lowercase audio ID');
  return value;
}

export function transitionFor(value: unknown, fallback: MusicTransition, path: string): MusicTransition {
  const control = musicObject(value, path);
  const at = transitionPoints.find(point => point === (control.at ?? fallback.at));
  const entry = entryPoints.find(point => point === (control.entry ?? fallback.entry));
  if (!at || !entry) throw Error(path + ' must use at=' + transitionPoints.join('|') + ' and entry=' + entryPoints.join('|'));
  const fadeBeats = musicNumber(control.fadeBeats ?? fallback.fadeBeats, path + '.fadeBeats', 0, 4);
  const wait = control.waitBars ?? fallback.waitBars;
  const waitBars = wait === undefined ? undefined : musicNumber(wait, path + '.waitBars', 0, 4, true);
  return { at, entry, fadeBeats, ...(waitBars === undefined ? {} : { waitBars }) };
}

export function readMusicRouting(value: unknown, sections: ReadonlySet<string>) {
  const data = musicObject(value, 'Adaptive');
  const states = Object.fromEntries(Object.entries(musicObject(data.states, 'Adaptive.states')).map(([state, section]) => {
    musicId(state, 'State name');
    const id = musicId(section, 'Adaptive.states.' + state);
    if (!sections.has(id)) throw Error('Unknown score section: ' + id);
    return [state, id];
  }));
  const initial = musicId(data.initial, 'Adaptive.initial');
  if (!Object.hasOwn(states, initial)) throw Error('Unknown initial state: ' + initial);
  const oneShot = data.oneShot ?? [];
  if (!Array.isArray(oneShot) || oneShot.some(state => typeof state !== 'string' || !Object.hasOwn(states, state)) ||
      new Set(oneShot).size !== oneShot.length) throw Error('Adaptive.oneShot must list distinct known states');

  const defaults = transitionFor(data.defaults ?? {}, { at: 'bar', entry: 'start', fadeBeats: 0.35 }, 'Adaptive.defaults');
  const edges = data.transitions ?? [];
  if (!Array.isArray(edges) || edges.length > 256) throw Error('Adaptive.transitions must be an array of up to 256 rules');
  const seen = new Set<string>();
  const transitions = edges.map((input, i) => {
    const path = 'Adaptive.transitions[' + i + ']';
    const rule = musicObject(input, path);
    const from = musicId(rule.from, path + '.from'), to = musicId(rule.to, path + '.to');
    if (!Object.hasOwn(states, from) || !Object.hasOwn(states, to) || from === to) throw Error(path + ' needs two different known states');
    const key = from + '/' + to;
    if (seen.has(key)) throw Error('Duplicate transition: ' + key);
    seen.add(key);
    return { from, to, ...transitionFor(rule, defaults, path) };
  });
  const bands = data.intensity ?? [];
  if (!Array.isArray(bands) || bands.length > 32) throw Error('Adaptive.intensity must be an array of up to 32 bands');
  const hysteresis = musicNumber(data.hysteresis ?? 0.04, 'Adaptive.hysteresis', 0, 0.25);
  let previous = -1;
  const intensity = bands.map((input, i) => {
    const path = 'Adaptive.intensity[' + i + ']';
    const band = musicObject(input, path);
    const min = musicNumber(band.min, path + '.min', 0, 1);
    const state = musicId(band.state, path + '.state');
    if ((i === 0 && min !== 0) || min <= previous || (i > 0 && min - previous <= hysteresis)) {
      throw Error('Intensity thresholds must start at 0 and rise by more than the hysteresis');
    }
    if (!Object.hasOwn(states, state)) throw Error('Unknown intensity state: ' + state);
    if (i > 0 && band.state === (bands[i - 1] as MusicIntensityBand).state) throw Error('Adjacent intensity bands need different states');
    previous = min;
    return { min, state };
  });
  return { states, initial, oneShot: oneShot as string[], defaults, transitions, intensity, hysteresis };
}

export function readAdaptiveBank(value: unknown): AdaptiveMusicBank {
  const data = musicObject(value, 'Bank');
  if (data.version !== 1) throw Error('Bank.version must be 1');
  const id = musicId(data.id, 'Bank.id');
  const bpm = musicNumber(data.bpm, 'Bank.bpm', 30, 300);
  const beatsPerBar = musicNumber(data.beatsPerBar, 'Bank.beatsPerBar', 2, 12, true);
  const sampleRate = musicNumber(data.sampleRate, 'Bank.sampleRate', 8000, 192000, true);
  const clips = Object.fromEntries(Object.entries(musicObject(data.clips, 'Bank.clips')).map(([section, value]) => {
    musicId(section, 'Clip ID');
    const clip = musicObject(value, 'Bank.clips.' + section);
    const beats = musicNumber(clip.beats, 'Clip beats', beatsPerBar, 3072, true);
    if (beats % beatsPerBar) throw Error('Clip beats must form complete bars: ' + section);
    const frames = musicNumber(clip.frames, 'Clip frames', Math.round(beats * (60 * sampleRate / bpm)), sampleRate * 300, true);
    if (clip.file !== 'section-' + section + '.wav') throw Error('Invalid clip filename: ' + section);
    let harmony: ClipHarmony[] | undefined;
    if (clip.harmony !== undefined) {
      if (!Array.isArray(clip.harmony) || clip.harmony.length !== beats / beatsPerBar) throw Error('Expected one harmony entry per bar: ' + section);
      harmony = clip.harmony.map(value => {
        const data = musicObject(value, 'Clip harmony');
        if (typeof data.chord !== 'string' || !data.chord.trim()) throw Error('Clip harmony needs a chord symbol');
        const bass = musicNumber(data.bass, 'Harmony bass pitch class', 0, 11, true);
        const mask = musicNumber(data.mask, 'Harmony pitch-class mask', 1, 4095, true);
        return { chord: data.chord, bass, mask };
      });
    }
    return [section, { beats, frames, file: clip.file, ...(harmony ? { harmony } : {}) }];
  }));
  return { version: 1, id, bpm, beatsPerBar, sampleRate, clips, ...readMusicRouting(data, new Set(Object.keys(clips))) };
}

function phase(beat: number, beats: number): number {
  const offset = ((beat % beats) + beats) % beats;
  return offset < epsilon || beats - offset < epsilon ? 0 : offset;
}

export function transitionOverlap(bank: AdaptiveMusicBank, previous: MusicStart | undefined, next: MusicStart): number {
  if (!previous || next.handoff?.mode === 'release') return 0;
  const clip = bank.clips[previous.section];
  const available = clip.frames * bank.bpm / (bank.sampleRate * 60) -
    (next.beat - previous.beat + previous.offsetBeat);
  const untilChange = next.handoff ? bank.beatsPerBar - phase(next.offsetBeat, bank.beatsPerBar) : Infinity;
  return Math.max(0, Math.min(next.fadeBeats, available, untilChange));
}

export function transitionEnvelope(bank: AdaptiveMusicBank, previous: MusicStart | undefined, next: MusicStart) {
  if (!previous || next.handoff?.mode !== 'release') {
    const overlap = transitionOverlap(bank, previous, next);
    return { overlap, before: 0, after: overlap };
  }
  return {
    overlap: 0,
    before: Math.min(next.fadeBeats, bank.bpm * 0.055 / 60, next.beat - previous.beat),
    after: Math.min(next.fadeBeats, bank.bpm * 0.018 / 60),
  };
}

function harmonyAffinity(a: ClipHarmony, b: ClipHarmony): number {
  if (a.bass !== b.bass) return 0;
  if (a.mask === b.mask) return 2;
  const shared = a.mask & b.mask;
  const afterFirst = shared & (shared - 1);
  return (shared === a.mask || shared === b.mask) && (afterFirst & (afterFirst - 1)) !== 0 ? 1 : 0;
}

function loopHandoff(harmony: ClipHarmony[] | undefined): MusicStart['handoff'] {
  if (!harmony?.length) return undefined;
  const first = harmony[0], last = harmony[harmony.length - 1];
  const affinity = harmonyAffinity(last, first);
  return { mode: affinity ? 'phase' : 'release', from: last.chord, to: first.chord, ...(affinity === 1 ? { shared: true } : {}) };
}

function harmonicChoice(
  bank: AdaptiveMusicBank, current: MusicStart, destination: AdaptiveClip, at: number, step: number, waits: number, fullEntry: boolean,
) {
  const source = bank.clips[current.section];
  const meter = bank.beatsPerBar;
  function chordAt(beat: number) {
    const elapsed = current.offsetBeat + beat - current.beat;
    const offset = phase(elapsed, source.beats);
    const bar = offset === 0 && elapsed > epsilon ? source.beats / meter - 1 : Math.floor(offset / meter);
    return { offset, chord: source.harmony?.[bar] };
  }
  for (let beat = at; beat <= at + waits + epsilon; beat += step) {
    const elapsed = current.offsetBeat + beat - current.beat;
    if (bank.oneShot.includes(current.state) && elapsed > source.beats + epsilon) break;
    const { offset, chord } = chordAt(beat);
    if (!chord || !destination.harmony) break;
    const aligned = phase(offset, destination.beats);
    const bar = Math.floor(aligned / meter);
    const candidates = fullEntry ? destination.harmony.slice(0, 1) : destination.harmony;
    let match = -1, affinity = 0;
    for (const [i, candidate] of candidates.entries()) {
      const strength = harmonyAffinity(candidate, chord);
      if (strength > affinity || (strength > 0 && strength === affinity && Math.abs(i - bar) < Math.abs(match - bar))) {
        match = i;
        affinity = strength;
      }
    }
    if (match !== -1) {
      return { beat, offsetBeat: fullEntry ? 0 : match * meter + phase(offset, meter), handoff: {
        mode: !fullEntry && match === bar ? 'phase' as const : 'match' as const, from: chord.chord, to: candidates[match].chord,
        ...(affinity === 1 ? { shared: true as const } : {}),
      } };
    }
  }
  const { chord } = chordAt(at);
  return { beat: at, offsetBeat: 0, handoff: {
    mode: 'release' as const, ...(chord ? { from: chord.chord } : {}),
    ...(destination.harmony ? { to: destination.harmony[0].chord } : {}),
  } };
}

export class AdaptiveMusicDirector {
  readonly bank: AdaptiveMusicBank;
  private current: MusicStart;
  private pending?: { state: string; beat: number; rule: MusicTransition; harmonic?: ReturnType<typeof harmonicChoice> };
  private horizon = 0;
  private inclusive = false;
  private started = false;
  private band = -1;
  private fadeThrough = 0;

  constructor(bank: AdaptiveMusicBank) {
    this.bank = bank;
    this.current = {
      state: bank.initial, section: bank.states[bank.initial], beat: 0, offsetBeat: 0, fadeBeats: 0, reason: 'initial',
    };
  }

  get scheduledThrough(): number {
    return this.horizon;
  }

  request(state: string, beat: number, overrides: Partial<MusicTransition> = {}): number | null {
    if (!Object.hasOwn(this.bank.states, state)) throw Error('Unknown music state: ' + state);
    musicNumber(beat, 'Requested beat', 0, Number.MAX_SAFE_INTEGER / 32);
    if (state === this.current.state) {
      this.pending = undefined;
      return null;
    }
    const edge = this.bank.transitions.find(rule => rule.from === this.current.state && rule.to === state);
    const rule = transitionFor(overrides, edge ?? this.bank.defaults, 'Transition override');
    const earliest = Math.max(beat, this.horizon + (this.inclusive ? 2 * epsilon : 0), this.fadeThrough);
    const step = rule.at === 'bar' ? this.bank.beatsPerBar : 1;
    const end = this.endOfCurrent();
    const length = this.bank.clips[this.current.section].beats;
    const at = rule.at === 'now' ? earliest : rule.at === 'end' ?
      this.bank.oneShot.includes(this.current.state) ? Math.max(end, earliest) :
        end + Math.max(0, Math.ceil((earliest - end - epsilon) / length)) * length :
      Math.ceil((earliest - epsilon) / step) * step;
    const searchStep = rule.at === 'end' ? length : step;
    const harmonic = rule.entry === 'harmonic' ? harmonicChoice(this.bank, this.current, this.bank.clips[this.bank.states[state]],
      at, searchStep, rule.at === 'now' ? 0 : (rule.waitBars ?? 1) * this.bank.beatsPerBar, this.bank.oneShot.includes(state)) : undefined;
    const scheduled = harmonic?.beat ?? at;
    if (this.pending?.state === state && this.pending.beat <= scheduled &&
        rule.at === this.pending.rule.at && rule.entry === this.pending.rule.entry && rule.fadeBeats === this.pending.rule.fadeBeats &&
        rule.waitBars === this.pending.rule.waitBars) {
      return this.pending.beat;
    }
    this.pending = { state, beat: scheduled, rule, harmonic };
    return scheduled;
  }

  setIntensity(value: number, beat: number, overrides: Partial<MusicTransition> = {}): number | null {
    musicNumber(value, 'Music intensity', 0, 1);
    const { intensity, hysteresis } = this.bank;
    if (!intensity.length) throw Error('This bank has no intensity mapping');
    let next = this.band < 0 ? 0 : this.band;
    while (next + 1 < intensity.length && value >= intensity[next + 1].min + (this.band < 0 ? 0 : hysteresis)) next++;
    while (next > 0 && value < intensity[next].min - hysteresis) next--;
    this.band = next;
    return this.request(intensity[next].state, beat, overrides);
  }

  advance(through: number, inclusive = true): MusicStart[] {
    musicNumber(through, 'Playback horizon', 0, Number.MAX_SAFE_INTEGER / 32);
    if (through < this.horizon) throw Error('Playback horizon cannot move backwards');
    this.horizon = through;
    this.inclusive = inclusive;
    const result: MusicStart[] = [];
    const due = (beat: number) => inclusive ? beat <= through + epsilon : beat < through - epsilon;
    if (!this.started && due(0)) {
      if (this.pending && this.pending.beat <= epsilon) {
        this.current = { ...this.current, state: this.pending.state, section: this.bank.states[this.pending.state] };
        this.pending = undefined;
      }
      this.started = true;
      result.push(this.current);
    }
    while (this.started) {
      const end = this.endOfCurrent();
      const oneShot = this.bank.oneShot.includes(this.current.state);
      if (oneShot && !this.pending) break;
      const change = this.pending && (oneShot || this.pending.beat <= end + epsilon) ? this.pending : undefined;
      const beat = change?.beat ?? end;
      if (!due(beat)) break;
      const state = change?.state ?? this.current.state;
      const section = this.bank.states[state];
      const length = this.bank.clips[section].beats;
      const handoff = change?.harmonic?.handoff ??
        (!change && this.bank.defaults.entry === 'harmonic' ? loopHandoff(this.bank.clips[section].harmony) : undefined);
      const offsetBeat = change?.harmonic?.offsetBeat ?? (change?.rule.entry === 'phase' && (!oneShot || beat <= end + epsilon) ?
        phase(phase(this.current.offsetBeat + beat - this.current.beat, this.bank.clips[this.current.section].beats), length) : 0);
      const next: MusicStart = {
        state, section, beat, offsetBeat,
        fadeBeats: Math.min(change?.rule.fadeBeats ?? this.bank.defaults.fadeBeats, (length - offsetBeat) / 2),
        reason: change ? 'transition' : 'repeat',
        ...(handoff ? { handoff } : {}),
      };
      if (change) this.pending = undefined;
      this.fadeThrough = beat + transitionEnvelope(this.bank, this.current, next).after;
      this.current = next;
      result.push(next);
    }
    return result;
  }

  private endOfCurrent(): number {
    return this.current.beat + this.bank.clips[this.current.section].beats - this.current.offsetBeat;
  }
}

export function previewMusicTimeline(bank: AdaptiveMusicBank, changes: readonly MusicChange[], beats: number): MusicStart[] {
  const director = new AdaptiveMusicDirector(bank);
  const actions: MusicStart[] = [];
  let last = -1;
  for (const change of changes) {
    if (change.beat < last || change.beat >= beats) throw Error('Preview changes must be ordered and inside the playback range');
    actions.push(...director.advance(change.beat, false));
    if (change.state === undefined) director.setIntensity(change.intensity, change.beat, change);
    else director.request(change.state, change.beat, change);
    last = change.beat;
  }
  actions.push(...director.advance(beats, false));
  return actions;
}
