import { arrangeCinematic, cinematicForm, cinematicTracks } from './cinematic.ts';
import { rng } from './dsp.ts';
import { arrangePhrases, phraseTracks } from './phrases.ts';
import { type MusicNote, type MusicQuality, type MusicScore, type MusicSection, type MusicTrack, readMusicScore } from './score.ts';
import { type Chord, chordTone, midiName, parseKey, parseProgression, voiceChord } from './theory.ts';

const styles = {
  menu: { bpm: 104, key: 'C major', major: 'Imaj7 vi7 IVmaj7 Vsus4', minor: 'i7 bVImaj7 bIIImaj7 bVII' },
  ambient: { bpm: 76, key: 'A minor', major: 'Iadd9 IVmaj7 vi7 ii7', minor: 'imadd9 bVImaj7 bIIIadd9 iv7' },
  arcade: { bpm: 132, key: 'D minor', major: 'I IV vi V', minor: 'i bVI bIII V' },
  cinematic: { bpm: 108, key: 'D minor', major: 'Iadd9 vi7 IVmaj7 Vsus4', minor: 'i bVImaj7 bIIIadd9 bVII' },
  chamber: { bpm: 82, key: 'G major', major: 'Iadd9 iii7 IVmaj7 Vsus4 I vi7 ii7 V7', minor: 'imadd9 bIIImaj7 iv7 V7 i bVImaj7 ii7 V7' },
  groove: { bpm: 98, key: 'Eb major', major: 'Imaj9 vim9 iim9 V13 iii7 vim9 iim9 V13', minor: 'im9 ivm9 bVImaj9 V13 bIIImaj9 bVImaj9 ii7 V7' },
} as const;

export const musicStyles = Object.keys(styles) as (keyof typeof styles)[];
export const paletteKey = (style: keyof typeof styles) => styles[style].key;

export interface ComposeMusicOptions {
  id?: string;
  style?: keyof typeof styles;
  bpm?: number;
  bars?: number;
  key?: string;
  progression?: string;
  chords?: readonly Chord[];
  seed?: number;
  loop?: boolean;
  quality?: MusicQuality;
  sections?: MusicSection[];
}

export function composeMusic(options: ComposeMusicOptions = {}): MusicScore {
  const style = options.style ?? 'menu';
  if (!musicStyles.includes(style)) throw Error('Unknown music style. Use ' + musicStyles.join(' or '));
  const preset = styles[style];
  const ambient = style === 'ambient';
  const arcade = style === 'arcade';
  const cinematic = style === 'cinematic';
  const ensemble = style === 'chamber' || style === 'groove' ? style : undefined;
  const quality = options.quality ?? (ensemble || ambient ? 'studio' : undefined);
  const phrases = ensemble ?? (ambient && quality === 'studio' ? style : undefined);
  const key = parseKey(options.key ?? preset.key);
  const bars = options.bars ?? options.sections?.reduce((total, section) => total + section.bars, 0) ?? (cinematic ? 16 : ensemble ? 12 : 8);
  const score = readMusicScore({
    version: 1,
    id: options.id ?? style + (options.loop === false ? '-cue' : '-loop'),
    bpm: options.bpm ?? preset.bpm,
    bars,
    key: key.name,
    seed: options.seed,
    loop: options.loop,
    quality,
    room: cinematic || phrases === 'ambient' ? 'hall' : ensemble ? 'studio' : undefined,
    sections: options.sections ?? (cinematic ? cinematicForm(bars) : ensemble ? cinematicForm(bars)?.map((section, index) =>
      ({ ...section, id: section.role + '-' + (index + 1) })) : undefined),
    tracks: cinematic ? cinematicTracks() : ensemble ? phraseTracks(ensemble) : [
      { id: 'drums', instrument: 'drums', gainDb: ambient ? -14 : -8, notes: [] },
      { id: 'bass', instrument: 'bass', gainDb: ambient ? -12 : -9, notes: [] },
      { id: 'harmony', instrument: 'pad', gainDb: ambient ? -10 : -15, pan: -0.14, reverb: phrases === 'ambient' ? 0.29 : undefined, notes: [] },
      { id: 'melody', instrument: arcade ? 'chip' : 'pluck', gainDb: ambient || arcade ? -11 : -8, pan: 0.17,
        reverb: phrases === 'ambient' ? 0.36 : undefined, notes: [] },
    ],
  });
  const chords = options.chords ?? parseProgression(options.progression ?? (key.minor ? preset.minor : preset.major), key);
  if (!chords.length) throw Error('The progression needs at least one chord');
  const authored = options.progression !== undefined || options.chords !== undefined;
  if (cinematic) {
    arrangeCinematic(score, chords, key.flats, authored);
    return score;
  }
  if (phrases) {
    arrangePhrases(score, chords, phrases, authored);
    return score;
  }
  const [drums, bass, harmony, melody] = score.tracks;
  const random = rng(score.seed);
  const motifs = [['R', '3', '5', '3'], ['5', '3', 'R', '3'], ['3', '5', '8', '5']] as const;
  const motif = motifs[Math.floor(random() * motifs.length)];
  let voicing: number[] | undefined;
  const sections = score.sections ?? [{ role: 'main', bars: score.bars }];
  let sectionIndex = 0, sectionStart = 0;

  for (let bar = 0; bar < score.bars; bar++) {
    if (bar >= sectionStart + sections[sectionIndex].bars) {
      sectionStart += sections[sectionIndex].bars;
      sectionIndex++;
    }
    const section = sections[sectionIndex];
    const sectionBar = bar - sectionStart;
    const beat = bar * score.beatsPerBar;
    const finalBar = bar === score.bars - 1;
    const quieter = section.role !== 'main';
    const ending = finalBar && section.role === 'outro';
    const chordIndex = authored ? bar : ending ? 0 : sectionBar + (section.role === 'break' ? 2 : 0);
    const chord = chords[chordIndex % chords.length];
    const variation = sectionBar % 8 >= 4;
    const add = (track: MusicTrack, at: number, duration: number, note: MusicNote['note'], strength: number) => {
      const velocity = Number((strength * (0.95 + random() * 0.10)).toFixed(3));
      track.notes.push({ beat: beat + at, duration, note, velocity });
    };
    const pitched = (track: MusicTrack, at: number, duration: number, midi: number, strength: number) => {
      add(track, at, duration, midiName(midi, key.flats), strength);
    };

    if (quieter || ambient) {
      if (section.role !== 'break' && sectionBar % 2 === 0) add(drums, 0, 0.4, 'kick', 0.62);
      if (!ending && sectionBar % 2 === 1) add(drums, 3, 0.25, 'hat', 0.34);
    } else {
      add(drums, 0, 0.45, 'kick', 0.94);
      add(drums, variation ? 2.5 : 2, 0.40, 'kick', 0.81);
      for (const at of [1, 3]) add(drums, at, 0.28, 'snare', at === 3 ? 0.78 : 0.71);
      for (const at of [0.5, 1.5, 2.5, 3.5]) add(drums, at, 0.16, 'hat', at === 1.5 ? 0.52 : 0.39);
      if (arcade && sectionBar % 4 === 3) add(drums, 3.75, 0.15, 'snare', 0.52);
    }

    const bassMidi = 36 + (chord.bass ?? chord.root) % 12;
    if (section.role !== 'break' && (section.role !== 'intro' || sectionBar > 0)) {
      pitched(bass, 0, ambient || quieter ? 3.25 : 1.24, bassMidi, quieter ? 0.66 : 0.8);
    }
    if (!ambient && !quieter) {
      pitched(bass, 1.5, 0.4, bassMidi, 0.62);
      pitched(bass, 2, 1.1, arcade && variation ? bassMidi + 12 : bassMidi, 0.74);
      pitched(bass, 3.5, 0.38, chordTone(chord, finalBar ? 'R' : '5', 36), 0.54);
    }

    voicing = voiceChord(chord, voicing, { low: 51, high: 78, center: 62 });
    for (const [i, midi] of voicing.entries()) {
      const offset = i * (ambient || quieter ? 0.025 : 0.012);
      pitched(harmony, offset, (ending ? 4 : ambient ? 3.86 : 3.72) - offset, midi, quieter ? 0.65 : 0.53);
    }

    if ((section.role === 'intro' && sectionBar === 0) || (ambient && sectionBar % 2 === 1 && !finalBar)) continue;
    const rhythm = ending ? [0] : ambient || quieter ? [0.75, 2.5] : finalBar ? [0, 0.75, 1.5] :
      variation ? [0.5, 1.25, 2.5, 3.25] : [0, 0.75, 1.75, 2.5];
    for (const [i, at] of rhythm.entries()) {
      const tone = ending ? 'R' : motif[(i + (sectionBar % 4 === 2 ? 1 : 0)) % motif.length];
      const raw = chordTone(chord, tone, 60);
      const midi = raw < 67 ? raw + 12 : raw;
      pitched(melody, at, arcade && !quieter ? 0.27 : ambient || quieter ? 0.9 : 0.51, midi, i === 0 ? 0.79 : 0.64);
    }
  }
  for (const track of score.tracks) track.notes.sort((a, b) => a.beat - b.beat);
  return score;
}
