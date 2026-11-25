import { noteMidi, parseChord, parseKey } from './theory.ts';

export const instrumentCatalog = {
  recipe: { role: 'Catalog sound recipe played as a pitch or a hit', articulations: [] },
  drums: { role: 'Drum kit and ensemble percussion', articulations: ['short', 'accent'] },
  bass: { role: 'Round synth bass', range: ['C1', 'C4'], articulations: ['sustain', 'short', 'accent'] },
  pad: { role: 'Detuned synth harmony', range: ['C3', 'C6'], articulations: ['sustain', 'short', 'swell'] },
  pluck: { role: 'FM bell and plucked lead', range: ['C3', 'C7'], articulations: ['sustain', 'short', 'accent'] },
  chip: { role: 'Pulse-wave lead', range: ['C3', 'C6'], articulations: ['sustain', 'short', 'accent'] },
  piano: { role: 'Hammered strings and exposed melody', range: ['A0', 'C8'], articulations: ['sustain', 'short', 'accent'], pedal: true },
  'nylon-guitar': { role: 'Finger-plucked string and resonant wooden body', range: ['E2', 'E6'], articulations: ['sustain', 'short', 'accent', 'mute'] },
  'electric-piano': { role: 'Warm tine keys for syncopated chords or melody', range: ['A1', 'C7'], articulations: ['sustain', 'short', 'accent'] },
  strings: { role: 'Bowed string section and rhythmic ostinati', range: ['C2', 'E7'], articulations: ['sustain', 'short', 'accent', 'swell', 'legato'], dynamics: true },
  cello: { role: 'Solo bowed voice and lower countermelody', range: ['C2', 'G5'], articulations: ['sustain', 'short', 'accent', 'swell', 'legato'], dynamics: true },
  violin: { role: 'Solo bowed melody and high countermelody', range: ['G3', 'E7'], articulations: ['sustain', 'short', 'accent', 'swell', 'legato'], dynamics: true },
  horn: { role: 'Rounded brass theme and accents', range: ['F2', 'C6'], articulations: ['sustain', 'short', 'accent', 'swell', 'legato'], dynamics: true },
  'electric-guitar': { role: 'Amplified picked strings and power chords', range: ['E2', 'E6'], articulations: ['sustain', 'short', 'accent', 'mute'] },
  timpani: { role: 'Tuned orchestral drums', range: ['D2', 'A3'], articulations: ['sustain', 'short', 'accent'] },
} as const;
export const instruments = Object.keys(instrumentCatalog) as Instrument[];
export const drumSounds = ['kick', 'snare', 'hat', 'low-drum', 'crash', 'tom'] as const;
export const sectionRoles = ['intro', 'main', 'break', 'outro'] as const;
export const rooms = ['studio', 'hall'] as const;
export const qualities = ['classic', 'studio'] as const;
export const musicSampleRate = 44_100;
export const studioSampleRate = 48_000;
export const maxMusicSeconds = 300;

export type Instrument = keyof typeof instrumentCatalog;
export type DrumSound = typeof drumSounds[number];
export type Articulation = typeof instrumentCatalog[Instrument]['articulations'][number];
export type MusicRoom = typeof rooms[number];
export type MusicQuality = typeof qualities[number];
export type AutomationPoint = readonly [beat: number, value: number];

export interface MusicSection {
  id?: string;
  role: typeof sectionRoles[number];
  bars: number;
  key?: string;
  chords?: string[];
  handoff?: { kind: 'pivot' | 'dominant'; chord: string };
}

export interface MusicNote {
  beat: number;
  duration: number;
  note: string | number;
  velocity: number;
  articulation?: Articulation;
}

export interface MusicTrack {
  id: string;
  instrument: Instrument;
  recipe?: string;
  root?: number;
  params?: Record<string, number>;
  gainDb: number;
  pan: number;
  reverb?: number;
  dynamics?: AutomationPoint[];
  expression?: AutomationPoint[];
  pedal?: AutomationPoint[];
  notes: MusicNote[];
}

export interface MusicScore {
  version: 1;
  id: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  key?: string;
  seed: number;
  loop: boolean;
  room?: MusicRoom;
  quality?: MusicQuality;
  master: { targetLufs: number; ceilingDbtp: number };
  tracks: MusicTrack[];
  sections?: MusicSection[];
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw Error(path + ' must be an object');
  }
  return value as Record<string, unknown>;
}

function numberInRange(value: unknown, min: number, max: number, path: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) {
    throw Error(path + ' must be ' + (integer ? 'an integer' : 'a number') + ' from ' + min + ' to ' + max);
  }
  return value;
}

function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 64) {
    throw Error(path + ' must be a lowercase ID of up to 64 letters, digits and hyphens');
  }
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value)) {
    throw Error(path + ' is reserved on Windows');
  }
  return value;
}

export function readMusicPart(track: Record<string, unknown>, path: string) {
  const instrument = instruments.find(name => name === track.instrument);
  if (!instrument) throw Error(path + '.instrument must be one of ' + instruments.join(', '));
  if (instrument !== 'recipe') {
    if (track.recipe !== undefined || track.root !== undefined || track.params !== undefined) {
      throw Error(path + ' needs instrument "recipe" to set recipe, root or params');
    }
    return { instrument };
  }
  if (typeof track.recipe !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(track.recipe)) {
    throw Error(path + '.recipe must name a catalog sound');
  }
  let root: number | undefined;
  if (track.root !== undefined) {
    try {
      root = typeof track.root === 'string' ? noteMidi(track.root) : numberInRange(track.root, 0, 127, path + '.root', true);
    } catch {
      throw Error(path + '.root must be a note name or MIDI number');
    }
  }
  const params = track.params === undefined ? undefined : Object.fromEntries(Object.entries(object(track.params, path + '.params'))
    .map(([key, value]) => [key, numberInRange(value, -Number.MAX_VALUE, Number.MAX_VALUE, path + '.params.' + key)]));
  return { instrument, recipe: track.recipe, ...(root === undefined ? {} : { root }), ...(params ? { params } : {}) };
}

function readNote(value: unknown, instrument: Instrument, root: number | undefined, beats: number, path: string): MusicNote {
  const data = object(value, path);
  const beat = numberInRange(data.beat, 0, beats, path + '.beat');
  if (beat >= beats) throw Error(path + '.beat must start before the end of the score');
  const duration = numberInRange(data.duration, 0.001, beats, path + '.duration');
  const velocity = numberInRange(data.velocity ?? 0.8, 0, 1, path + '.velocity');
  const note = data.note;
  if (instrument === 'drums') {
    if (!drumSounds.some(sound => sound === note)) throw Error(path + '.note must be one of ' + drumSounds.join(', '));
  } else if (instrument === 'recipe' && root === undefined) {
    if (note !== 'hit') throw Error(path + '.note must be "hit" for a recipe without a root');
  } else if (typeof note === 'string') {
    try {
      noteMidi(note);
    } catch (error) {
      throw Error(path + '.note ' + (error as Error).message);
    }
  } else {
    numberInRange(note, 0, 127, path + '.note (MIDI)', true);
  }
  const allowed = instrumentCatalog[instrument].articulations;
  const articulation = allowed.find(value => value === data.articulation);
  if (data.articulation !== undefined && !articulation) {
    if (instrument === 'recipe') throw Error(path + '.articulation is unavailable on recipe notes. Set duration and velocity');
    throw Error(path + '.articulation for ' + instrument + ' must be one of ' + allowed.join(', '));
  }
  return { beat, duration, note: note as string | number, velocity, ...(articulation ? { articulation } : {}) };
}

function readSections(input: unknown, bars: number): MusicSection[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > bars) {
    throw Error('Score.sections must contain at least one section and no more sections than bars');
  }
  const seen = new Set<string>();
  const sections = input.map((value, i) => {
    const path = 'Score.sections[' + i + ']';
    const section = object(value, path);
    const role = sectionRoles.find(role => role === section.role);
    if (!role) throw Error(path + '.role must be one of ' + sectionRoles.join(', '));
    const named = section.id === undefined ? undefined : id(section.id, path + '.id');
    if (named && seen.has(named)) throw Error('Duplicate section ID: ' + named);
    if (named) seen.add(named);
    const size = numberInRange(section.bars, 1, bars, path + '.bars', true);
    if (section.key !== undefined && typeof section.key !== 'string') throw Error(path + '.key must name a key');
    const key = section.key === undefined ? undefined : parseKey(section.key);
    let chords: string[] | undefined;
    if (section.chords !== undefined) {
      if (!Array.isArray(section.chords) || section.chords.length !== size) throw Error(path + '.chords needs an absolute chord per bar');
      chords = section.chords.map((value, i) => {
        if (typeof value !== 'string') throw Error(path + '.chords[' + i + '] must be a chord symbol');
        return parseChord(value, key?.flats).symbol;
      });
    }
    let handoff: MusicSection['handoff'];
    if (section.handoff !== undefined) {
      const data = object(section.handoff, path + '.handoff');
      if ((data.kind !== 'pivot' && data.kind !== 'dominant') || typeof data.chord !== 'string' ||
          data.chord !== chords?.at(-1)) throw Error(path + '.handoff must name the closing chord');
      handoff = { kind: data.kind, chord: data.chord };
    }
    return {
      ...(named ? { id: named } : {}), role, bars: size, ...(key ? { key: key.name } : {}),
      ...(chords ? { chords } : {}), ...(handoff ? { handoff } : {}),
    };
  });
  if (sections.reduce((total, section) => total + section.bars, 0) !== bars) {
    throw Error('Score.sections must cover exactly ' + bars + ' bars');
  }
  return sections;
}

function readCurve(input: unknown, beats: number, path: string): AutomationPoint[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 2048) throw Error(path + ' must contain 1 to 2048 [beat, value] points');
  let lastBeat = -1;
  return input.map((point, i) => {
    if (!Array.isArray(point) || point.length !== 2) throw Error(path + '[' + i + '] must be [beat, value]');
    const beat = numberInRange(point[0], 0, beats, path + '[' + i + '][0]');
    if (beat <= lastBeat) throw Error(path + ' beats must be strictly increasing');
    lastBeat = beat;
    return [beat, numberInRange(point[1], 0, 1, path + '[' + i + '][1]')];
  });
}

export function readMusicScore(input: unknown): MusicScore {
  const data = object(input, 'Score');
  if (data.version !== 1) throw Error('Score.version must be 1');
  const scoreId = id(data.id, 'Score.id');
  const bpm = numberInRange(data.bpm, 30, 300, 'Score.bpm');
  const bars = numberInRange(data.bars, 1, 256, 'Score.bars', true);
  const beatsPerBar = numberInRange(data.beatsPerBar ?? 4, 2, 12, 'Score.beatsPerBar', true);
  const beats = bars * beatsPerBar;
  if (beats * 60 / bpm > maxMusicSeconds) throw Error('Score exceeds ' + maxMusicSeconds + ' seconds');
  const sections = data.sections === undefined ? undefined : readSections(data.sections, bars);
  const seed = numberInRange(data.seed ?? 104729, 0, 0xffffffff, 'Score.seed', true);
  const loop = data.loop ?? true;
  if (typeof loop !== 'boolean') throw Error('Score.loop must be true or false');
  const room = rooms.find(room => room === data.room);
  if (data.room !== undefined && !room) throw Error('Score.room must be one of ' + rooms.join(', '));
  const quality = qualities.find(quality => quality === data.quality);
  if (data.quality !== undefined && !quality) throw Error('Score.quality must be one of ' + qualities.join(', '));
  const mastering = object(data.master ?? {}, 'Score.master');
  const master = {
    targetLufs: numberInRange(mastering.targetLufs ?? -18, -36, -8, 'Score.master.targetLufs'),
    ceilingDbtp: numberInRange(mastering.ceilingDbtp ?? -1, -12, -0.1, 'Score.master.ceilingDbtp'),
  };
  const key = data.key;
  if (key !== undefined) {
    if (typeof key !== 'string') throw Error('Score.key must be a key name');
    parseKey(key);
  }
  if (!Array.isArray(data.tracks) || data.tracks.length < 1 || data.tracks.length > 16) {
    throw Error('Score.tracks must contain 1 to 16 tracks');
  }
  const seen = new Set<string>();
  const tracks = data.tracks.map((value, i): MusicTrack => {
    const path = 'Score.tracks[' + i + ']';
    const track = object(value, path);
    const trackId = id(track.id, path + '.id');
    if (seen.has(trackId)) throw Error('Duplicate track ID: ' + trackId);
    seen.add(trackId);
    const part = readMusicPart(track, path);
    const { instrument } = part;
    const root = part.instrument === 'recipe' ? part.root : undefined;
    const gainDb = numberInRange(track.gainDb ?? 0, -90, 12, path + '.gainDb');
    const pan = numberInRange(track.pan ?? 0, -1, 1, path + '.pan');
    const reverb = track.reverb === undefined ? undefined : numberInRange(track.reverb, 0, 1, path + '.reverb');
    if (track.dynamics !== undefined && !('dynamics' in instrumentCatalog[instrument])) {
      throw Error(path + '.dynamics is supported on strings, cello, violin and horn. Use expression to shape gain on other tracks');
    }
    const dynamics = track.dynamics === undefined ? undefined : readCurve(track.dynamics, beats, path + '.dynamics');
    const expression = track.expression === undefined ? undefined : readCurve(track.expression, beats, path + '.expression');
    if (track.pedal !== undefined && instrument !== 'piano') throw Error(path + '.pedal is a piano control');
    const pedal = track.pedal === undefined ? undefined : readCurve(track.pedal, beats, path + '.pedal');
    if (pedal?.some(([, value]) => value !== 0 && value !== 1)) throw Error(path + '.pedal values must be 0 or 1');
    if (loop && pedal?.every(([, value]) => value === 1)) throw Error(path + '.pedal needs a pedal-up event in a loop');
    if (loop) for (const [name, curve] of [['dynamics', dynamics], ['expression', expression], ['pedal', pedal]] as const) {
      if (curve?.[0][0] === 0 && curve.at(-1)![0] === beats && curve[0][1] !== curve.at(-1)![1]) {
        throw Error(path + '.' + name + ' must have matching values at beat zero and the loop endpoint');
      }
    }
    if (!Array.isArray(track.notes) || track.notes.length > 4096) {
      throw Error(path + '.notes must be an array with up to 4096 events');
    }
    const notes = track.notes.map((note, j) => readNote(note, instrument, root, beats, path + '.notes[' + j + ']'));
    return {
      id: trackId, ...part, gainDb, pan, ...(reverb === undefined ? {} : { reverb }),
      ...(dynamics ? { dynamics } : {}), ...(expression ? { expression } : {}), ...(pedal ? { pedal } : {}), notes,
    };
  });
  return {
    version: 1, id: scoreId, bpm, beatsPerBar, bars, ...(key === undefined ? {} : { key }),
    seed, loop, ...(room ? { room } : {}), ...(quality ? { quality } : {}), master,
    ...(sections === undefined ? {} : { sections }), tracks,
  };
}
