import { rng } from './dsp.ts';
import type { Articulation, MusicNote, MusicScore, MusicTrack } from './score.ts';
import { chordName, chordTone, isChordTone, nearestScaleTone, parseKey, voiceChord, type Chord } from './theory.ts';

type PhraseStyle = 'ambient' | 'chamber' | 'groove';
type Figure = readonly [beat: number, duration: number, tone: string];

const phrases: Record<PhraseStyle, readonly (readonly Figure[])[]> = {
  ambient: [
    [[0.48, 1.24, '5'], [2.24, 1.5, '3']], [[1.68, 1.7, '9']],
    [[0.48, 1.24, '5'], [2.24, 1.5, '3']], [[1.24, 2.52, 'R']],
  ],
  chamber: [
    [[0.18, 0.90, '3'], [1.10, 0.70, '5'], [1.82, 1.51, 'R']], [[0.46, 1.00, '5'], [1.50, 1.30, '3']],
    [[0.18, 0.90, '3'], [1.10, 0.70, '5'], [1.82, 1.51, 'R']], [[0.36, 0.58, '5'], [0.96, 0.84, '3'], [1.84, 1.95, 'R']],
  ],
  groove: [
    [[0.52, 0.36, '3'], [1.29, 0.54, '5'], [2.53, 0.43, '9']], [[0.79, 0.46, '7'], [1.54, 0.82, '5']],
    [[0.52, 0.36, '3'], [1.29, 0.54, '5'], [2.53, 0.43, '9']], [[0.79, 0.38, '7'], [1.30, 0.31, '5'], [2.18, 1.20, 'R']],
  ],
};

const part = (id: string, instrument: MusicTrack['instrument'], gainDb: number, pan = 0, reverb?: number): MusicTrack =>
  ({ id, instrument, gainDb, pan, reverb, notes: [] });

export function phraseTracks(style: 'chamber' | 'groove') {
  return style === 'chamber' ? [
    part('melody', 'cello', -10, 0.13, 0.25), part('harmony', 'nylon-guitar', -12, -0.25, 0.20),
    part('bass', 'cello', -19, -0.06, 0.20), part('answer', 'piano', -15, 0.28, 0.24),
  ] : [
    part('melody', 'pluck', -14, 0.15, 0.13), part('harmony', 'electric-piano', -12, -0.16, 0.21),
    part('bass', 'bass', -10), part('drums', 'drums', -11, 0, 0.09), part('answer', 'nylon-guitar', -16, 0.25, 0.14),
  ];
}

const near = (pitch: number, target: number) => pitch + 12 * Math.round((target - pitch) / 12);

function arrangeDrums(add: WriteBar, drums: MusicTrack, intensity: number, turn: boolean) {
  add(drums, 0, 0.39, 'kick', 0.84 * intensity);
  add(drums, turn ? 2.53 : 2.27, 0.28, 'kick', 0.72 * intensity);
  for (const [i, at] of [1.028, 3.034].entries()) add(drums, at, 0.24, 'snare', (0.58 + i * 0.12) * intensity);
  for (const [i, at] of [0, 0.54, 1.52, 2.02, 2.55, 3.53].entries()) add(drums, at, 0.16, 'hat', (i % 3 === 1 ? 0.36 : 0.24) * intensity);
  if (turn) add(drums, 3.76, 0.18, 'snare', 0.31 * intensity);
}

type WriteBar = (track: MusicTrack, at: number, duration: number, note: MusicNote['note'], velocity: number, articulation?: Articulation) => void;

export function arrangePhrases(score: MusicScore, chords: readonly Chord[], style: PhraseStyle, useWrittenChords: boolean): void {
  const tracks = new Map(score.tracks.map(track => [track.id, track]));
  const melody = tracks.get('melody')!, harmony = tracks.get('harmony')!, bass = tracks.get('bass')!;
  const answer = tracks.get('answer'), drums = tracks.get('drums');
  const chamber = style === 'chamber', groove = style === 'groove';
  const key = parseKey(score.key!);
  const random = rng(score.seed);
  const bars = (score.sections ?? [{ role: 'main', bars: score.bars }]).flatMap(section =>
    Array.from({ length: section.bars }, (_, index) => ({ role: section.role, key: section.key ? parseKey(section.key) : key, first: index === 0 })));
  const progression = bars.map((_, i) => chords[!useWrittenChords && !score.loop && i === bars.length - 1 ? 0 : i % chords.length]);
  let firstBar = 0;
  for (const section of score.sections ?? []) {
    section.chords ??= progression.slice(firstBar, firstBar + section.bars).map(chord => chordName(chord, bars[firstBar].key.flats));
    firstBar += section.bars;
  }
  let voicing: number[] | undefined;
  let lead = chamber ? 62 : 72;
  let low = chamber ? 42 : 38;
  let held = new Map<number, MusicNote>();

  for (const [index, bar] of bars.entries()) {
    const chord = progression[index];
    const next = progression[index + 1] ?? (score.loop ? progression[0] : undefined);
    const start = index * score.beatsPerBar;
    const last = !score.loop && !next;
    const turn = index % 4 === 3;
    const quiet = bar.role !== 'main';
    const strength = bar.role === 'break' ? 0.67 : quiet || bar.first ? 0.81 : 1;
    const add: WriteBar = (track, at, duration, note, velocity, articulation) => {
      track.notes.push({ beat: start + at, duration, note,
        velocity: Number((velocity * (0.96 + 0.08 * random())).toFixed(3)), ...(articulation ? { articulation } : {}) });
    };

    voicing = voiceChord(chord, voicing, { low: chamber ? 52 : 49, high: chamber ? 71 : 76, center: chamber ? 57 : 61 });
    if (chamber) {
      const order = last ? [0, 1, 2, 3] : quiet ? [0, 2, 1, 3] : [0, 1, 2, 3, 1, 2, 0, 2];
      for (const [i, voice] of order.entries()) {
        const at = last ? 0.12 * i : i * 4 / order.length + (i % 2 ? 0.028 : 0);
        add(harmony, at, last ? 3.52 - at : 0.95, voicing[voice % voicing.length], (i % 4 === 0 ? 0.70 : 0.54) * strength);
      }
    } else if (groove) {
      const rhythm = last ? [0] : quiet ? [0.22, 2.03] : turn ? [0.02, 1.55, 2.82] : [0.02, 1.03, 2.53, 3.32];
      for (const [i, at] of rhythm.entries()) voicing.forEach((pitch, voice) =>
        add(harmony, at + voice * 0.012, last ? 3.72 : i % 2 ? 0.39 : 0.78, pitch, (i === 0 ? 0.72 : 0.55) * strength));
    } else {
      const current = new Map<number, MusicNote>();
      for (const pitch of voicing) {
        const previous = held.get(pitch);
        if (previous && previous.duration < 8) {
          previous.duration += 4;
          current.set(pitch, previous);
        } else {
          add(harmony, 0, 4, pitch, 0.55 * strength);
          current.set(pitch, harmony.notes.at(-1)!);
        }
      }
      held = current;
    }

    low = near(chord.bass ?? chord.root, (low + (chamber ? 44 : 38)) / 2);
    add(bass, 0, groove && !last ? 0.92 : 3.64, low, 0.72 * strength);
    if (groove && !last) {
      add(bass, 1.53, 0.46, low, 0.57 * strength);
      add(bass, 2.28, 0.78, near(chordTone(chord, '5', 36), low + 4), 0.68 * strength);
    }
    if ((groove || (chamber && turn)) && next && next.root !== chord.root) {
      const arrival = near(next.bass ?? next.root, low);
      const step = arrival >= low ? -1 : 1;
      add(bass, 3.56, 0.39, nearestScaleTone(bar.key, arrival + step), 0.52 * strength);
    }

    const motif = last ? [[0.20, 2.72, 'R']] as const : phrases[style][index % 4];
    for (const [i, [at, duration, tone]] of motif.entries()) {
      const center = chamber ? 62 : groove ? 74 : 71;
      const pitch = near(chordTone(chord, tone, 60), (lead + center) / 2 + (i === 1 ? 2 : 0));
      lead = isChordTone(chord, pitch) ? pitch : nearestScaleTone(bar.key, pitch);
      add(melody, at, duration, lead, (i === 0 ? 0.75 : 0.65) * strength, chamber && i > 0 ? 'legato' : undefined);
    }
    if (answer && !last && index % 2 === 1) {
      const pitch = near(chordTone(chord, turn ? '3' : '5', 60), chamber ? 73 : 62);
      add(answer, turn ? 3.02 : 2.62, 0.76, pitch, 0.56 * strength);
      if (!turn) add(answer, 3.5, 0.43, near(chord.root, pitch - 3), 0.45 * strength);
    }
    if (drums && groove && !last) arrangeDrums(add, drums, strength, turn);
    if (drums && style === 'ambient' && index % 4 === 2) add(drums, 0, 0.40, 'kick', 0.38);
  }
  for (const track of score.tracks) track.notes.sort((a, b) => a.beat - b.beat);
}
