// Pitch, key, scale, chord and voice-leading helpers. Pure functions with no audio dependency.

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FLAT_KEYS: ReadonlySet<number> = new Set([5, 10, 3, 8, 1, 6]);

// Semitone offsets from the tonic.
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  doubleHarmonic: [0, 1, 4, 5, 7, 8, 11],
  hungarianMinor: [0, 2, 3, 5, 6, 8, 11],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
} as const;
export type ScaleName = keyof typeof SCALES;

const MINOR_SCALES: ReadonlySet<ScaleName> = new Set<ScaleName>([
  'minor', 'harmonicMinor', 'melodicMinor', 'dorian', 'phrygian', 'locrian', 'phrygianDominant',
  'doubleHarmonic', 'hungarianMinor', 'minorPentatonic', 'blues', 'diminished',
]);
const SCALE_ALIASES: Record<string, ScaleName> = {
  ionian: 'major', aeolian: 'minor', naturalminor: 'minor', maj: 'major', min: 'minor', dominant: 'mixolydian',
  gypsy: 'hungarianMinor', spanish: 'phrygianDominant', spanishgypsy: 'phrygianDominant', persian: 'doubleHarmonic',
  byzantine: 'doubleHarmonic', pentatonic: 'majorPentatonic', minorblues: 'blues', wholetone: 'wholeTone',
  halfwhole: 'diminished', octatonic: 'diminished',
};

function accidentalOffset(text: string): number {
  let offset = 0;
  for (const c of text) {
    if (c === 'b') offset--;
    else if (c === '#') offset++;
    else throw Error('Unknown accidental in "' + text + '"');
  }
  return offset;
}

export function pitchClass(text: string): number {
  const m = /^([A-Ga-g])([b#]+)?$/.exec(text.trim());
  if (!m) throw Error('Unknown pitch class: ' + text);
  return (LETTER[m[1].toUpperCase()] + accidentalOffset(m[2] ?? '') + 24) % 12;
}

// Note names use scientific pitch: C4 is MIDI 60 and A4 is 440 Hz.
export function noteMidi(name: string): number {
  const m = /^([A-Ga-g])([b#]+)?\s*(-?\d+)$/.exec(name.trim());
  if (!m) throw Error('Unknown note name (use C4, F#3, Bb2): ' + name);
  const midi = LETTER[m[1].toUpperCase()] + accidentalOffset(m[2] ?? '') + (Number(m[3]) + 1) * 12;
  if (midi < 0 || midi > 127) throw Error('Note outside the MIDI range: ' + name);
  return midi;
}

export function midiName(midi: number, flats = false): string {
  if (!Number.isFinite(midi)) return '?';
  const rounded = Math.round(midi);
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((rounded % 12) + 12) % 12] + (Math.floor(rounded / 12) - 1);
}

export const midiHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const hzMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

export interface Key {
  readonly tonic: number; // pitch class 0-11
  readonly scale: ScaleName;
  readonly flats: boolean;
  readonly minor: boolean;
  readonly name: string;
}

// Accepts "C", "A minor", "am", "D dorian", "F# minor", "Eb" and every other scale name.
export function parseKey(text: string): Key {
  const m = /^\s*([A-Ga-g])([b#]+)?\s*([\w\s:-]*)$/.exec(String(text));
  if (!m) throw Error('Unknown key (use C, A minor, D dorian, F# minor): ' + text);
  const letter = m[1], accidental = m[2] ?? '';
  const mode = m[3].trim().toLowerCase().replace(/[\s_:-]+/g, '');
  let scale: ScaleName | undefined;
  if (!mode) scale = letter === letter.toLowerCase() ? 'minor' : 'major';
  else if (mode === 'major' || mode === 'maj' || mode === 'ionian') scale = 'major';
  else if (mode === 'minor' || mode === 'min' || mode === 'm' || mode === 'aeolian') scale = 'minor';
  else scale = (Object.keys(SCALES) as ScaleName[]).find((name) => name.toLowerCase() === mode) ??
    (Object.hasOwn(SCALE_ALIASES, mode) ? SCALE_ALIASES[mode] : undefined);
  if (!scale) throw Error('Unknown mode "' + mode + '". Use major, minor, dorian, phrygian, lydian, mixolydian, locrian, harmonicMinor, melodicMinor, minorPentatonic or blues.');
  const tonic = (LETTER[letter.toUpperCase()] + accidentalOffset(accidental) + 24) % 12;
  const flats = accidental ? accidental.startsWith('b') : FLAT_KEYS.has(tonic);
  return { tonic, scale, flats, minor: MINOR_SCALES.has(scale), name: (flats ? FLAT_NAMES : SHARP_NAMES)[tonic] + ' ' + scale };
}

// The tonic placed in the octave that starts at C4.
export const keyBase = (key: Key): number => 60 + key.tonic;
export const scaleLength = (key: Key): number => SCALES[key.scale].length;

export function degreeMidi(key: Key, degree: number, alteration = 0): number {
  const scale = SCALES[key.scale], length = scale.length;
  return keyBase(key) + 12 * Math.floor(degree / length) + scale[((degree % length) + length) % length] + alteration;
}

export function inScale(key: Key, midi: number): boolean {
  const scale: readonly number[] = SCALES[key.scale];
  return scale.includes((((Math.round(midi) - key.tonic) % 12) + 12) % 12);
}

export function nearestScaleTone(key: Key, midi: number): number {
  if (inScale(key, midi)) return Math.round(midi);
  for (let distance = 1; distance < 6; distance++) {
    if (inScale(key, midi + distance)) return midi + distance;
    if (inScale(key, midi - distance)) return midi - distance;
  }
  return Math.round(midi);
}

// Move by scale steps instead of semitones. A non-scale input snaps down to the scale tone below it.
export function scaleStep(key: Key, midi: number, steps: number): number {
  const scale = SCALES[key.scale], length = scale.length, base = keyBase(key);
  const relative = Math.round(midi) - base, octave = Math.floor(relative / 12), pitch = ((relative % 12) + 12) % 12;
  let index = 0;
  for (let i = 0; i < length; i++) if (scale[i] <= pitch) index = i;
  const total = octave * length + index + steps;
  return base + 12 * Math.floor(total / length) + scale[((total % length) + length) % length];
}

export const CHORDS = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], five: [0, 7],
  maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10],
  maj7b5: [0, 4, 6, 11], six: [0, 4, 7, 9], m6: [0, 3, 7, 9], mMaj7: [0, 3, 7, 11], aug7: [0, 4, 8, 10],
  sevenSus4: [0, 5, 7, 10], sevenb5: [0, 4, 6, 10], sevenb9: [0, 4, 7, 10, 13], sevenSharp9: [0, 4, 7, 10, 15],
  maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14], nine: [0, 4, 7, 10, 14], add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14], six9: [0, 4, 7, 9, 14], maj7sharp11: [0, 4, 7, 11, 18], eleven: [0, 4, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17], thirteen: [0, 4, 7, 10, 14, 21], m13: [0, 3, 7, 10, 14, 21],
} as const;
export type ChordQuality = keyof typeof CHORDS;
const CHORD_QUALITIES = Object.keys(CHORDS) as ChordQuality[];
const QUALITY_SYMBOL: Record<ChordQuality, string> = {
  maj: '', min: 'm', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4', five: '5', maj7: 'maj7', min7: 'm7',
  dom7: '7', dim7: 'dim7', m7b5: 'm7b5', maj7b5: 'maj7b5', six: '6', m6: 'm6', mMaj7: 'mMaj7', aug7: 'aug7',
  sevenSus4: '7sus4', sevenb5: '7b5', sevenb9: '7b9', sevenSharp9: '7#9', maj9: 'maj9', min9: 'm9', nine: '9',
  add9: 'add9', madd9: 'madd9', six9: '6/9', maj7sharp11: 'maj7#11', eleven: '11', m11: 'm11', thirteen: '13', m13: 'm13',
};

export interface Chord {
  readonly root: number; // MIDI pitch class placed at C4 (60-71)
  readonly quality: ChordQuality;
  readonly intervals: readonly number[];
  readonly symbol: string;
  readonly bass?: number; // MIDI pitch class placed at C3 (48-59) for slash chords
  readonly degree?: number; // zero-based scale degree for roman numerals
}

const SUFFIX: readonly (readonly [RegExp, ChordQuality])[] = [
  [/^maj7#11$/, 'maj7sharp11'], [/^maj7b5$/, 'maj7b5'], [/^maj7$|^major7$/, 'maj7'], [/^maj9$/, 'maj9'],
  [/^m7b5$|^min7b5$/, 'm7b5'], [/^mmaj7$|^minmaj7$|^mm7$/, 'mMaj7'], [/^madd9$|^minadd9$/, 'madd9'],
  [/^7sus4$|^7sus$|^sus47$/, 'sevenSus4'], [/^7b9$|^dom7b9$/, 'sevenb9'], [/^7#9$/, 'sevenSharp9'],
  [/^7b5$/, 'sevenb5'], [/^7#5$|^aug7$/, 'aug7'], [/^add9$|^add2$/, 'add9'], [/^sus4$|^sus$/, 'sus4'], [/^sus2$/, 'sus2'],
  [/^dim7$|^o7$/, 'dim7'], [/^dim$|^diminished$|^o$/, 'dim'], [/^aug$|^augmented$/, 'aug'],
  [/^m11$|^min11$/, 'm11'], [/^11$/, 'eleven'], [/^m13$|^min13$/, 'm13'], [/^13$/, 'thirteen'],
  [/^m9$|^min9$/, 'min9'], [/^9$/, 'nine'], [/^69$/, 'six9'], [/^m6$|^min6$/, 'm6'], [/^6$/, 'six'],
  [/^m7$|^min7$/, 'min7'], [/^7$|^dom7$/, 'dom7'], [/^m$|^min$|^minor$/, 'min'], [/^maj$|^major$/, 'maj'],
  [/^5$|^power$/, 'five'], [/^$/, 'maj'],
];

export function normalizeSuffix(raw: string): string {
  return raw.replace(/Δ7|Δ/g, 'maj7').replace(/[°º]/g, 'dim').replace(/ø7|ø/g, 'm7b5').replace(/[()/]/g, '')
    .replace(/^M(?=[79])/, 'maj').replace(/M7/g, 'maj7').replace(/^M$/, 'maj')
    .replace(/^-(\d)/, 'm$1').replace(/^-$/, 'm').replace(/\+/g, 'aug').toLowerCase();
}

export function qualityFromSuffix(raw: string): ChordQuality {
  const text = normalizeSuffix(raw);
  const rule = SUFFIX.find(([pattern]) => pattern.test(text));
  if (!rule) throw Error('Unknown chord type "' + raw + '". Use maj, m, dim, aug, sus2, sus4, 5, 6, m6, 7, maj7, m7, mMaj7, dim7, m7b5, aug7, 9, maj9, m9, add9, 11, m11, 13, 7sus4, 7b9 or 7#9.');
  return rule[1];
}

export function chordName(chord: Chord, flats = false): string {
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  return names[chord.root % 12] + QUALITY_SYMBOL[chord.quality] +
    (chord.bass !== undefined ? '/' + names[chord.bass % 12] : '');
}

// Parses chord symbols such as C, Am7, F#m, Bb, G7/D, Cmaj7, Dm7b5 and Csus2.
export function parseChord(symbol: string, flats = false): Chord {
  const m = /^([A-Ga-g])([b#]+)?([^/]*)(?:\/([A-Ga-g])([b#]+)?)?$/.exec(symbol.trim().replace(/6\/9(?![A-Ga-g])/, '69'));
  if (!m) throw Error('Unknown chord symbol: ' + symbol);
  const quality = qualityFromSuffix(m[3]);
  const chord: Chord = {
    root: 60 + pitchClass(m[1] + (m[2] ?? '')), quality, intervals: CHORDS[quality], symbol: '',
    ...(m[4] ? { bass: 48 + pitchClass(m[4] + (m[5] ?? '')) } : {}),
  };
  return { ...chord, symbol: chordName(chord, flats) };
}

function qualityOf(intervals: readonly number[]): ChordQuality | undefined {
  return CHORD_QUALITIES.find((quality) => {
    const reference = CHORDS[quality];
    return reference.length === intervals.length && reference.every((value, i) => value === intervals[i]);
  });
}

const AUTO_TRIADS: ReadonlySet<ChordQuality> = new Set(['maj', 'min', 'dim']);
const AUTO_SEVENTHS: ReadonlySet<ChordQuality> = new Set(['maj7', 'min7', 'dom7', 'm7b5']);
const MINOR_LIKE: ReadonlySet<ChordQuality> = new Set(['min', 'dim', 'min7', 'm7b5', 'dim7', 'm6', 'min9', 'madd9', 'm11', 'm13', 'mMaj7']);
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, ix: 2, xi: 4, xiii: 6 };

// Parses roman numerals such as I, V7, vi, IV, ii7, bVII, bII, iii and vii°.
// A bare numeral keeps the diatonic chord when its colour agrees with the letter case, so both
// "i VI III VII" and "i bIII bVII" resolve to the same chords in a minor key.
export function parseRoman(text: string, key: Key): Chord {
  const m = /^(b+|#+)?(viii|vii|vi|iv|v|iii|ii|ix|xi|i|x|VIII|VII|VI|IV|V|III|II|IX|XI|I|X)(.*)$/.exec(text.trim());
  if (!m) throw Error('Unknown roman numeral: ' + text);
  const numeral = m[2], lower = numeral.toLowerCase(), upper = numeral !== lower;
  const number = ROMAN[lower], degree = number - 1;
  const scale = SCALES[key.scale];
  if (!number || number > scale.length) throw Error('Degree "' + text + '" lies outside the ' + key.scale + ' scale');
  const requested = m[1] ? (m[1][0] === 'b' ? -1 : 1) * m[1].length : 0;
  // A flat or sharp the key scale already applies to this degree restates it: bIII in minor is the diatonic third.
  const accidental = Math.sign(scale[degree] - SCALES.major[degree]) === Math.sign(requested) ? 0 : requested;
  const stacked = (size: number, offset = 0): number[] => {
    const base = degreeMidi(key, degree) + offset;
    return Array.from({ length: size }, (_, i) => i ? ((degreeMidi(key, degree + 2 * i) - base) % 12 + 12) % 12 : 0);
  };
  const auto = (size: number): { quality: ChordQuality; offset: number } | undefined => {
    if (accidental !== 0) return undefined;
    const allowed = size === 3 ? AUTO_TRIADS : AUTO_SEVENTHS;
    const diatonic = qualityOf(stacked(size));
    if (diatonic && allowed.has(diatonic)) {
      if (MINOR_LIKE.has(diatonic) === !upper) return { quality: diatonic, offset: 0 };
      // On the seventh degree, vii is the raised leading-tone chord and VII the lowered subtonic.
      if (degree === scale.length - 1) {
        const offset = upper ? -1 : 1;
        const substitute = qualityOf(stacked(size, offset));
        const wanted: readonly string[] = size === 3 ? [upper ? 'maj' : 'dim'] : upper ? ['dom7', 'maj7'] : ['dim7'];
        if (substitute && wanted.includes(substitute)) return { quality: substitute, offset };
      }
    }
    return undefined;
  };
  const plain = normalizeSuffix(m[3]);
  let quality: ChordQuality, offset = 0;
  if (!m[3]) { const found = auto(3); quality = found?.quality ?? (upper ? 'maj' : 'min'); offset = found?.offset ?? 0; }
  else if (plain === '7') { const found = auto(4); quality = found?.quality ?? (upper ? 'dom7' : 'min7'); offset = found?.offset ?? 0; }
  else quality = qualityFromSuffix(m[3]);
  // A diminished chord on a minor seventh degree is the raised leading-tone chord: vii° in A minor is G#dim.
  if (!accidental && !offset && degree === scale.length - 1 && scale[degree] === 10 && ['dim', 'dim7', 'm7b5'].includes(quality)) offset = 1;
  const shift = accidental + offset;
  const root = 60 + (((key.tonic + scale[degree] + shift) % 12) + 12) % 12;
  const chord: Chord = { root, quality, intervals: CHORDS[quality], symbol: '', degree };
  return { ...chord, symbol: chordName(chord, shift ? shift < 0 : key.flats) };
}

// Space, comma or pipe separated chord symbols or roman numerals: "Am F C G" or "i VI III VII".
export function parseProgression(text: string, key: Key): Chord[] {
  return text.trim().split(/[\s,|]+/).filter(Boolean).map((token) => {
    if (/^[A-G]/.test(token)) return parseChord(token, key.flats);
    if (/^(b|#)?[ivxIVX]/.test(token)) return parseRoman(token, key);
    throw Error('Unknown chord token "' + token + '". Use a chord symbol (Am7) or a roman numeral (i7).');
  });
}

export const isChordTone = (chord: Chord, midi: number): boolean =>
  chord.intervals.some((interval) => ((midi - chord.root - interval) % 12 + 12) % 12 === 0);

const DEGREE_INTERVAL: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12, 9: 14, 10: 16, 11: 17, 12: 19, 13: 21 };

// Resolves a chord-relative degree such as "R", "3", "b7", "8" or "10" to MIDI at or above `base`.
// Plain thirds, fifths and sevenths follow the chord's own quality.
export function chordTone(chord: Chord, name: string, base: number): number {
  const token = name.trim();
  if (!/^(?:R|r|1|[b#]?\d{1,2})$/.test(token)) throw Error('Unknown chord degree: ' + name);
  const root = base + (((chord.root - base) % 12) + 12) % 12;
  const accidental = token[0] === 'b' ? -1 : token[0] === '#' ? 1 : 0;
  const degree = Number(token.replace(/^[b#]/, '').replace(/^[Rr]$/, '1'));
  let interval = DEGREE_INTERVAL[degree];
  if (interval === undefined) throw Error('Unknown chord degree: ' + name);
  const quality = chord.quality;
  if (accidental === 0) {
    if (degree === 3) interval = quality === 'sus4' || quality === 'sevenSus4' ? 5 : quality === 'sus2' ? 2 : chord.intervals.includes(3) ? 3 : 4;
    if (degree === 5) interval = ['dim', 'dim7', 'm7b5', 'maj7b5', 'sevenb5'].includes(quality) ? 6 : quality === 'aug' || quality === 'aug7' ? 8 : 7;
    if (degree === 7 && chord.intervals.includes(10)) interval = 10;
    if (degree === 10 && chord.intervals.includes(3)) interval = 15;
  }
  return root + interval + accidental;
}

export interface VoicingOptions {
  voices?: number;
  low?: number;
  high?: number;
  center?: number;
}

function drop(voicing: number[], fromTop: number): number[] {
  const sorted = [...voicing].sort((a, b) => a - b);
  sorted[sorted.length - 1 - fromTop] -= 12;
  return sorted;
}

// Chooses the inversion and octave placement that moves least from the previous voicing.
export function voiceChord(chord: Chord, previous: readonly number[] | undefined, options: VoicingOptions = {}): number[] {
  const tones = chord.intervals.map((interval) => chord.root + interval);
  const count = Math.max(1, Math.min(options.voices ?? Math.min(4, tones.length), tones.length));
  const low = options.low ?? 48, high = options.high ?? 84, center = options.center ?? 64;
  const candidates: number[][] = [];
  for (let inversion = 0; inversion < tones.length; inversion++) {
    const closed = Array.from({ length: count }, (_, i) => {
      const k = i + inversion;
      return tones[k % tones.length] + 12 * Math.floor(k / tones.length);
    });
    for (let octave = -5; octave <= 5; octave++) {
      const base = closed.map((note) => note + 12 * octave);
      for (const candidate of count >= 3 ? [base, drop(base, 1), drop(base, 2)] : [base]) {
        const sorted = [...candidate].sort((a, b) => a - b);
        if (sorted[0] < low || sorted[count - 1] > high) continue;
        let spaced = true;
        for (let i = 1; i < count; i++) if (sorted[i] - sorted[i - 1] > 16 || (i > 1 && sorted[i] - sorted[i - 1] < 2)) spaced = false;
        if (spaced) candidates.push(sorted);
      }
    }
  }
  if (!candidates.length) return tones.slice(0, count).map((tone) => low + (((tone - low) % 12) + 12) % 12).sort((a, b) => a - b);
  const cost = (voicing: number[]) => {
    if (!previous) return Math.abs(voicing[0] + voicing[count - 1] - 2 * center) + Math.abs(voicing[count - 1] - center - 7);
    const sharedVoices = Math.min(count, previous.length);
    let total = 0;
    for (let i = 0; i < sharedVoices; i++) total += Math.abs(voicing[i] - previous[i]);
    for (let i = 0; i < count - 1; i++) {
      if (i + 1 < sharedVoices && (voicing[i] > previous[i + 1] || voicing[i + 1] < previous[i])) total += 1.5;
      total += Math.max(0, voicing[i + 1] - voicing[i] - 14) * 0.5;
    }
    for (let i = 0; i < sharedVoices; i++) for (let j = i + 1; j < sharedVoices; j++) {
      const interval = voicing[j] - voicing[i];
      if (interval === previous[j] - previous[i] && interval % 12 === 0 && voicing[i] !== previous[i]) total += 1.2;
    }
    return total;
  };
  let best = candidates[0], bestCost = Infinity;
  for (const candidate of candidates) {
    const value = cost(candidate);
    if (value < bestCost - 1e-9) { best = candidate; bestCost = value; }
  }
  return best;
}

export function voiceProgression(chords: readonly Chord[], options: VoicingOptions = {}): number[][] {
  let previous: number[] | undefined;
  return chords.map((chord) => {
    previous = voiceChord(chord, previous, options);
    return previous;
  });
}
