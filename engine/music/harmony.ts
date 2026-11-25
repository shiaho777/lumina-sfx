import {
  CHORDS, type Chord, chordName, degreeMidi, inScale, midiName, type Key, parseKey, parseProgression, scaleLength,
} from './theory.ts';

export interface HarmonySection {
  id: string;
  key?: string;
  chords: readonly string[];
  path: string;
}

const pc = (note: number) => (note % 12 + 12) % 12;
const distance = (a: number, b: number) => Math.min(pc(a - b), pc(b - a));
const tones = (chord: Chord) => chord.intervals.map(interval => pc(chord.root + interval));
export const harmonySignature = (chord: Chord) => ({
  chord: chord.symbol,
  bass: pc(chord.bass ?? chord.root),
  mask: tones(chord).reduce((mask, note) => mask | (1 << note), 0),
});

function majorOrMinorTriads(key: Key): Chord[] {
  const chords: Chord[] = [];
  for (let degree = 0; degree < scaleLength(key); degree++) {
    const root = degreeMidi(key, degree);
    for (const quality of ['maj', 'min'] as const) {
      const intervals = CHORDS[quality];
      if (!intervals.every(interval => inScale(key, root + interval))) continue;
      const chord = { root, quality, intervals, symbol: '' };
      chords.push({ ...chord, symbol: chordName(chord, key.flats) });
    }
  }
  return chords;
}

function voicingDistance(a: Chord, b: Chord): number {
  const from = tones(a), to = tones(b);
  return to.reduce((total, note) => total + Math.min(...from.map(pitch => distance(pitch, note))), 0) / to.length;
}

function dominantOf(key: Key): Chord {
  const root = 60 + pc(key.tonic + 7);
  return { root, quality: 'dom7', intervals: CHORDS.dom7, symbol: midiName(root, key.flats).slice(0, -1) + '7' };
}

function pivotBetween(from: Key, to: Key, previous: Chord | undefined, next: Chord): Chord {
  const goal = tones(next);
  const common = majorOrMinorTriads(from).filter(chord => tones(chord).every(tone => inScale(to, tone)));
  const movement = (chord: Chord) => {
    const root = pc(chord.root - to.tonic);
    const leadsTowardsGoal = root === 2 || root === 5 ? 0.55 : 0;
    const repeatedTonic = chord.root % 12 === to.tonic && goal.includes(to.tonic) ? 1 : 0;
    const repeat = previous && harmonySignature(previous).mask === harmonySignature(chord).mask ? 0.96 : 0;
    return (previous ? voicingDistance(previous, chord) : 0) + voicingDistance(chord, next) +
      repeatedTonic + repeat - leadsTowardsGoal;
  };
  return common.sort((a, b) => movement(a) - movement(b))[0] ?? dominantOf(to);
}

function readChord(text: string, key: Key, path: string): Chord {
  try {
    const [chord] = parseProgression(text, key);
    if (!chord) throw Error('Expected one chord per bar');
    return chord;
  } catch (error) {
    throw Error(path + ' in ' + key.name + ': ' + (error as Error).message);
  }
}

export function resolveHarmony(sections: readonly HarmonySection[], homeKey: Key, loop = false) {
  let key = homeKey;
  const written = sections.map(section => {
    if (section.key !== undefined) {
      try {
        key = parseKey(section.key);
      } catch (error) {
        throw Error(section.path + '.key: ' + (error as Error).message);
      }
    }
    const localKey = key;
    return { section, key: localKey, written: section.chords.map((chord, i) => {
      if (chord === '@pivot' || chord === '@dominant') return chord;
      return readChord(chord, localKey, section.path + '.chords[' + i + ']');
    }) };
  });

  return written.map((part, i) => {
    const next = written[i + 1] ?? (loop ? written[0] : undefined);
    const chords: Chord[] = [];
    let handoff: { kind: 'pivot' | 'dominant'; chord: string } | undefined;
    for (const [bar, writtenChord] of part.written.entries()) {
      if (typeof writtenChord !== 'string') {
        chords.push(writtenChord);
        continue;
      }
      const target = next?.written[0];
      if (bar !== part.written.length - 1 || !next || !target || typeof target === 'string' ||
          (part.key.tonic === next.key.tonic && part.key.scale === next.key.scale)) {
        throw Error(part.section.path + '.chords[' + bar + '] ' + writtenChord +
          ' belongs in the final bar before a different key with a written entry chord');
      }
      const chord = writtenChord === '@pivot' ? pivotBetween(part.key, next.key, chords.at(-1), target) : dominantOf(next.key);
      handoff = { kind: chord.quality === 'dom7' ? 'dominant' : 'pivot', chord: chordName(chord, part.key.flats) };
      chords.push(chord);
    }
    return { key: part.key, chords, handoff };
  });
}
