import { rng } from './dsp.ts';
import type { Articulation, MusicNote, MusicScore, MusicSection, MusicTrack } from './score.ts';
import { type Chord, chordTone, midiName, voiceChord } from './theory.ts';

export function cinematicForm(bars: number): MusicSection[] | undefined {
  if (!Number.isInteger(bars) || bars < 4) return undefined;
  const intro = Math.floor(bars / 4), outro = Math.max(1, Math.floor(bars / 8));
  if (bars < 8) return [{ role: 'intro', bars: intro }, { role: 'main', bars: bars - intro - outro }, { role: 'outro', bars: outro }];
  const quiet = Math.floor(bars / 8), main = bars - intro - outro - quiet;
  return [
    { role: 'intro', bars: intro }, { role: 'main', bars: Math.ceil(main / 2) },
    { role: 'break', bars: quiet }, { role: 'main', bars: Math.floor(main / 2) }, { role: 'outro', bars: outro },
  ];
}

export function cinematicTracks(): MusicTrack[] {
  return [
    { id: 'piano', instrument: 'piano', gainDb: -8, pan: -0.16, reverb: 0.27, notes: [] },
    { id: 'strings', instrument: 'strings', gainDb: -13, pan: -0.19, reverb: 0.35, notes: [] },
    { id: 'ostinato', instrument: 'strings', gainDb: -12, pan: 0.23, reverb: 0.24, notes: [] },
    { id: 'cello', instrument: 'cello', gainDb: -12, pan: 0.20, reverb: 0.30, notes: [] },
    { id: 'horn', instrument: 'horn', gainDb: -11, pan: -0.06, reverb: 0.29, notes: [] },
    { id: 'guitar', instrument: 'electric-guitar', gainDb: -12, pan: 0.32, reverb: 0.13, notes: [] },
    { id: 'bass', instrument: 'bass', gainDb: -14, pan: 0, notes: [] },
    { id: 'percussion', instrument: 'drums', gainDb: -10, pan: 0, reverb: 0.22, notes: [] },
    { id: 'timpani', instrument: 'timpani', gainDb: -12, pan: -0.24, reverb: 0.28, notes: [] },
  ];
}

function near(midi: number, target: number): number {
  return midi + 12 * Math.round((target - midi) / 12);
}

export function arrangeCinematic(score: MusicScore, chords: readonly Chord[], flats: boolean, useWrittenChords: boolean): void {
  const [piano, strings, ostinato, cello, horn, guitar, bass, percussion, timpani] = score.tracks;
  const random = rng(score.seed);
  const phrases = [
    [['R', '3', '5'], ['5', '3'], ['R', '3', '8'], ['5', '3', 'R']],
    [['3', '5', 'R'], ['3', '5'], ['3', '5', '8'], ['5', '9', 'R']],
    [['5', '3', 'R'], ['3', '5'], ['5', '3', '8'], ['5', '3', 'R']],
  ];
  const phrase = phrases[Math.floor(random() * phrases.length)];
  let bar = 0, mainCount = 0;
  let previous: number[] | undefined;
  for (const section of score.sections ?? [{ role: 'main', bars: score.bars }]) {
    const main = section.role === 'main';
    const reprise = main && mainCount > 0;
    if (main) mainCount++;
    for (let index = 0; index < section.bars; index++, bar++) {
      const ending = section.role === 'outro' && bar === score.bars - 1;
      const sectionEnd = index === section.bars - 1;
      const chord = chords[ending && !score.loop && !useWrittenChords ? 0 : bar % chords.length];
      const beat = bar * score.beatsPerBar;
      function add(track: MusicTrack, at: number, duration: number, note: MusicNote['note'], strength: number, articulation?: Articulation) {
        const velocity = Number((strength * (0.945 + 0.11 * random())).toFixed(3));
        track.notes.push({ beat: beat + at, duration, note, velocity, ...(articulation ? { articulation } : {}) });
      }
      function pitched(track: MusicTrack, at: number, duration: number, midi: number, strength: number, articulation?: Articulation) {
        add(track, at, duration, midiName(midi, flats), strength, articulation);
      }

      const root = near(chord.bass ?? chord.root, 42);
      const voicing = voiceChord(chord, previous, { low: 53, high: 75, center: 62 });
      previous = voicing;
      if (section.role !== 'intro' || index > 0) {
        for (const [i, note] of voicing.entries()) {
          const offset = i * 0.032;
          pitched(strings, offset, (ending ? 3.9 : 3.69) - offset, note, main ? 0.56 : 0.43, main ? 'sustain' : 'swell');
        }
        pitched(cello, 0, 3.6, near(root, main ? 50 : 48), main ? 0.58 : 0.51, main ? 'sustain' : 'swell');
      }

      if (main) {
        pitched(piano, 0, 1.2, near(root, 54), 0.67, 'accent');
        pitched(piano, 2.75, 0.58, voicing.at(-1)!, 0.53);
        pitched(bass, 0, 1.28, near(root, 37), 0.79);
        pitched(bass, 2, 1.15, near(root, 37), 0.72);
        for (let slot = 0; slot < 8; slot++) {
          const note = near(voicing[(slot + Number(reprise)) % voicing.length], reprise ? 68 : 64);
          pitched(ostinato, slot * 0.5 + (slot % 2 ? 0.016 : 0), 0.38, note, slot % 4 === 0 ? 0.76 : 0.58, 'short');
        }
        const guitarRoot = near(chord.root, 45);
        for (const at of reprise ? [0, 0.76, 1.5, 2.04, 2.8, 3.48] : [0, 1.48, 2.25, 3.48]) {
          const open = at === 0 || (at === 3.48 && sectionEnd);
          pitched(guitar, at, open ? 0.47 : 0.27, guitarRoot, open ? 0.75 : 0.57, open ? 'accent' : 'mute');
          if (open) pitched(guitar, at + 0.018, 0.49, guitarRoot + 7, 0.64, 'accent');
        }
        const notes = phrase[index % phrase.length];
        notes.forEach((degree, i) => {
          const at = notes.length === 2 ? [0.53, 2.0][i] : [0, 0.89, 2.04][i];
          const target = (reprise ? 66 : 61) + (i === 2 && index % 4 === 2 ? 5 : 0);
          pitched(horn, at, i === notes.length - 1 ? 1.55 : 0.67, near(chordTone(chord, degree, 60), target),
            i === 0 ? 0.77 : 0.68, i === 0 ? 'accent' : 'sustain');
        });
        add(percussion, 0, 0.8, 'low-drum', 0.79, 'accent');
        add(percussion, 1.07, 0.31, 'snare', reprise ? 0.64 : 0.52);
        add(percussion, 2.49, 0.37, 'kick', 0.64);
        add(percussion, 3.04, 0.31, 'snare', reprise ? 0.66 : 0.54);
        if (index === 0 || (reprise && sectionEnd)) add(percussion, 0.035, 1.2, 'crash', 0.62);
        if (reprise || index === 0) pitched(timpani, 0.11, 0.83, near(root, 47), 0.64, 'accent');
        if (sectionEnd) pitched(timpani, 3.28, 0.60, near(root + 7, 50), 0.58);
      } else if (ending) {
        pitched(piano, 0, 3.72, near(root, 43), 0.52);
        for (const note of voicing) pitched(piano, 0.08 + (note % 5) * 0.036, 3.47, note, 0.47);
        pitched(piano, 1.23, 2.1, near(chord.root, 73), 0.44);
      } else {
        pitched(piano, 0, 1.65, near(root, 48), 0.61);
        const notes = phrase[index % phrase.length];
        notes.forEach((degree, i) => {
          const at = notes.length === 2 ? [0.76, 2.25][i] : [0.54, 1.32, 2.45][i];
          pitched(piano, at, i === notes.length - 1 ? 1.12 : 0.74, near(chordTone(chord, degree, 60), 69 + i * 2), 0.67);
        });
        if (section.role === 'break' && sectionEnd) {
          pitched(horn, 2.1, 1.65, near(chord.root, 58), 0.50, 'swell');
          add(percussion, 3.53, 0.45, 'low-drum', 0.49);
        }
      }
    }
  }
  for (const track of score.tracks) track.notes.sort((a, b) => a.beat - b.beat);
}
