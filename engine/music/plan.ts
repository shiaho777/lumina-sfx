import { composeMusic, musicStyles, paletteKey, type ComposeMusicOptions } from './compose.ts';
import { resolveHarmony, type HarmonySection } from './harmony.ts';
import { instruments, readMusicScore, sectionRoles, type MusicNote, type MusicScore, type MusicTrack } from './score.ts';
import { chordName, degreeMidi, type Key, noteMidi, parseKey, scaleLength } from './theory.ts';

type MotifPitch = { note: string | number } | { degree: number; octave: number; accidental: number };
type MotifNote = Omit<MusicNote, 'note'> & { pitch: MotifPitch };

export function musicSourceKind(input: unknown) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return;
  if (Object.hasOwn(input, 'tracks')) return 'score';
  if (Object.hasOwn(input, 'states') || Object.hasOwn(input, 'score')) return 'routing';
  if (Object.hasOwn(input, 'sections') || Object.hasOwn(input, 'motifs')) return 'plan';
}

export function readMusicSource(input: unknown): MusicScore {
  return musicSourceKind(input) === 'score' ? readMusicScore(input) : arrangeMusic(input);
}

function record(value: unknown, path: string, fields?: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error(path + ' must be an object');
  const data = value as Record<string, unknown>;
  const allowed = fields?.split(' ');
  if (allowed) for (const field of Object.keys(data)) {
    if (!allowed.includes(field)) throw Error('Unknown field ' + path + '.' + field + '. Use ' + allowed.join(', '));
  }
  return data;
}

function items(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw Error(path + ' must be an array');
  return value;
}

function number(value: unknown, path: string, lo: number, hi: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi || (integer && !Number.isInteger(value))) {
    throw Error(path + ' must be ' + (integer ? 'an integer' : 'a number') + ' from ' + lo + ' to ' + hi);
  }
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw Error(path + ' must be a nonempty string');
  return value;
}

function readPitch(data: Record<string, unknown>, path: string): MotifPitch {
  if (data.degree !== undefined) {
    if (data.note !== undefined) throw Error(path + ' must choose note or degree');
    return {
      degree: number(data.degree, path + '.degree', 1, 12, true),
      octave: number(data.octave ?? 4, path + '.octave', 0, 8, true),
      accidental: number(data.accidental ?? 0, path + '.accidental', -2, 2, true),
    };
  }
  if (data.octave !== undefined || data.accidental !== undefined) throw Error(path + ' needs a degree for octave or accidental');
  return { note: typeof data.note === 'number' ? number(data.note, path + '.note', 0, 127, true) : text(data.note, path + '.note') };
}

function readMotifs(value: unknown) {
  const motifs = new Map<string, MotifNote[]>();
  for (const [name, pattern] of Object.entries(record(value, 'Plan.motifs'))) {
    const path = 'Plan.motifs.' + name;
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw Error(path + ' needs a lowercase motif ID');
    const notes = items(pattern, path);
    if (!notes.length || notes.length > 128) throw Error(path + ' needs 1 to 128 notes');
    motifs.set(name, notes.map((input, i) => {
      const at = path + '[' + i + ']';
      const data = record(input, at, 'beat note degree octave accidental duration velocity articulation');
      return {
        pitch: readPitch(data, at),
        beat: number(data.beat, at + '.beat', 0, 3072),
        duration: number(data.duration, at + '.duration', 0.001, 3072),
        velocity: number(data.velocity ?? 0.8, at + '.velocity', 0, 1),
        articulation: data.articulation as MusicNote['articulation'],
      };
    }));
  }
  return motifs;
}

function readSections(value: unknown) {
  const sections = items(value, 'Plan.sections');
  if (!sections.length || sections.length > 256) throw Error('Plan.sections needs 1 to 256 sections');
  return sections.map((input, i) => {
    const path = 'Plan.sections[' + i + ']';
    const data = record(input, path, 'id role key chords mute statements');
    const role = sectionRoles.find(role => role === data.role);
    if (!role) throw Error(path + '.role must be one of ' + sectionRoles.join(', '));
    const chords = items(data.chords, path + '.chords').map(chord => {
      if (typeof chord !== 'string' || !/^[^,|\s]+$/.test(chord)) throw Error(path + '.chords needs one chord symbol per bar');
      return chord;
    });
    if (!chords.length) throw Error(path + '.chords needs at least one bar');
    const harmony: HarmonySection = { id: text(data.id, path + '.id'), key: data.key === undefined ? undefined : text(data.key, path + '.key'), chords, path };
    return { ...harmony, role, bars: chords.length, mutes: items(data.mute ?? [], path + '.mute'),
      statements: items(data.statements ?? [], path + '.statements') };
  });
}

function transposePitch(pitch: MotifPitch, transpose: number, key: Key, track: MusicTrack, path: string): string | number {
  if ('note' in pitch && !transpose) return pitch.note;
  if (track.instrument === 'drums') throw Error(path + ' needs an untransposed drum sound');
  if ('note' in pitch) return (typeof pitch.note === 'number' ? pitch.note : noteMidi(pitch.note)) + transpose;
  if (pitch.degree > scaleLength(key)) throw Error(path + ' degree ' + pitch.degree + ' is outside ' + key.name);
  return degreeMidi(key, pitch.degree - 1, pitch.accidental) + (pitch.octave - 4) * 12 + transpose;
}

function placeStatement(input: unknown, path: string, section: {
  start: number; bars: number; nextBars: number; beatsPerBar: number; key: Key;
}, tracks: ReadonlyMap<string, MusicTrack>, motifs: ReturnType<typeof readMotifs>) {
  const data = record(input, path, 'track motif beat bar transpose stretch strength articulation layer carry');
  const track = tracks.get(text(data.track, path + '.track'));
  if (!track) throw Error(path + '.track is unknown. Available tracks: ' + [...tracks.keys()].join(', '));
  const motif = motifs.get(text(data.motif, path + '.motif'));
  if (!motif) throw Error(path + '.motif is unknown. Available motifs: ' + [...motifs.keys()].join(', '));
  if (data.beat !== undefined && data.bar !== undefined) throw Error(path + ' must choose beat or bar');
  const length = section.bars * section.beatsPerBar;
  const at = data.bar === undefined ? number(data.beat ?? 0, path + '.beat', 0, length) :
    (number(data.bar, path + '.bar', 1, section.bars, true) - 1) * section.beatsPerBar;
  const transpose = number(data.transpose ?? 0, path + '.transpose', -36, 36, true);
  const stretch = number(data.stretch ?? 1, path + '.stretch', 0.25, 4);
  const strength = number(data.strength ?? 1, path + '.strength', 0, 1.5);
  if (data.layer !== undefined && typeof data.layer !== 'boolean') throw Error(path + '.layer must be true or false');
  if (data.carry !== undefined && typeof data.carry !== 'boolean') throw Error(path + '.carry must be true or false');
  const end = length + (data.carry === true ? section.nextBars * section.beatsPerBar : 0);
  const notes = motif.map((note, i): MusicNote => {
    const position = at + note.beat * stretch;
    const duration = note.duration * stretch;
    if (position >= length || position + duration > end + 1e-8) {
      throw Error(path + (data.carry ? ' must start in its section and end by the end of the next section' : ' extends beyond its section'));
    }
    return {
      beat: section.start + position, duration, velocity: Math.min(1, note.velocity * strength),
      note: transposePitch(note.pitch, transpose, section.key, track, path + '.motif note ' + (i + 1)),
      articulation: (data.articulation ?? note.articulation) as MusicNote['articulation'],
    };
  });
  return { track, notes, layer: data.layer === true };
}

export function arrangeMusic(input: unknown): MusicScore {
  const plan = record(input, 'Plan', 'version id style bpm key seed loop quality room master motifs sections parts mix');
  if (plan.version !== 1) throw Error('Plan.version must be 1');
  const id = text(plan.id, 'Plan.id');
  const style = musicStyles.find(style => style === (plan.style ?? 'cinematic'));
  if (!style) throw Error('Plan.style must be one of ' + musicStyles.join(', '));
  const key = parseKey(text(plan.key ?? paletteKey(style), 'Plan.key'));
  const motifs = readMotifs(plan.motifs ?? {});
  const sections = readSections(plan.sections);
  const harmony = resolveHarmony(sections, key, plan.loop === true);
  const base = composeMusic({
    id, style, key: key.name, chords: harmony.flatMap(section => section.chords),
    sections: sections.map(({ id, role, bars }, i) => ({
      id, role, bars, key: harmony[i].key.name,
      chords: harmony[i].chords.map(chord => chordName(chord, harmony[i].key.flats)), handoff: harmony[i].handoff,
    })),
    bpm: plan.bpm as ComposeMusicOptions['bpm'], seed: plan.seed as ComposeMusicOptions['seed'],
    loop: (plan.loop ?? false) as ComposeMusicOptions['loop'], quality: (plan.quality ?? 'studio') as ComposeMusicOptions['quality'],
  });
  const backing = new Set(base.tracks.flatMap(track => track.notes));
  const tracks = new Map(base.tracks.map(track => [track.id, track]));
  for (const [id, value] of Object.entries(record(plan.parts ?? {}, 'Plan.parts'))) {
    const instrument = instruments.find(instrument => instrument === value);
    if (!instrument) throw Error('Plan.parts.' + id + ' must be an instrument from music instruments');
    if (tracks.has(id)) throw Error('Plan.parts.' + id + ' already belongs to the ' + style + ' palette');
    const track = { id, instrument, gainDb: -12, pan: 0, notes: [] };
    tracks.set(id, track);
    base.tracks.push(track);
  }
  let start = 0;
  for (const [i, { bars, path, mutes, statements }] of sections.entries()) {
    const end = start + bars * base.beatsPerBar;
    const muted = new Set(mutes.map(value => {
      const id = text(value, path + '.mute');
      if (!tracks.has(id)) throw Error(path + '.mute has an unknown track: ' + id);
      return id;
    }));
    const placed = statements.map((value, j) => placeStatement(value, path + '.statements[' + j + ']',
      { start, bars, nextBars: sections[i + 1]?.bars ?? 0, beatsPerBar: base.beatsPerBar, key: harmony[i].key }, tracks, motifs));
    const replace = new Set(muted);
    for (const { track, layer } of placed) {
      if (muted.has(track.id)) throw Error(path + ' has a statement on muted track ' + track.id);
      if (!layer) replace.add(track.id);
    }
    for (const id of replace) {
      const track = tracks.get(id)!;
      track.notes = track.notes.filter(note => note.beat < start || note.beat >= end);
      for (const note of track.notes) {
        if (backing.has(note) && note.beat < start && note.beat + note.duration > start) note.duration = start - note.beat;
      }
    }
    for (const { track, notes } of placed) track.notes.push(...notes);
    start = end;
  }

  const mix = record(plan.mix ?? {}, 'Plan.mix');
  for (const id of Object.keys(mix)) if (!tracks.has(id)) throw Error('Plan.mix has an unknown track: ' + id);
  return readMusicScore({
    ...base, quality: plan.quality ?? 'studio', room: plan.room ?? base.room, master: plan.master ?? base.master,
    tracks: base.tracks.map(track => ({
      ...track, ...record(mix[track.id] ?? {}, 'Plan.mix.' + track.id, 'gainDb pan reverb dynamics expression pedal'),
      notes: [...track.notes].sort((a, b) => a.beat - b.beat),
    })),
  });
}
