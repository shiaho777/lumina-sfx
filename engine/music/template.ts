import type { ComposeMusicOptions } from './compose.ts';

function ensembleTemplate(style: 'chamber' | 'groove', id: string) {
  const chamber = style === 'chamber';
  const theme = chamber ? [
    { beat: 0.18, degree: 3, octave: 3, duration: 0.90, velocity: 0.70 },
    { beat: 1.10, degree: 5, octave: 3, duration: 0.72, velocity: 0.64 },
    { beat: 1.84, degree: 6, octave: 3, duration: 0.62, velocity: 0.66 },
    { beat: 2.48, degree: 5, octave: 3, duration: 1.18, velocity: 0.60 },
  ] : [
    { beat: 0.53, degree: 3, octave: 4, duration: 0.35, velocity: 0.68 },
    { beat: 1.27, degree: 5, octave: 4, duration: 0.51, velocity: 0.65 },
    { beat: 2.52, degree: 7, octave: 4, duration: 0.34, velocity: 0.69 },
    { beat: 3.02, degree: 5, octave: 4, duration: 0.52, velocity: 0.61 },
  ];
  const phrase = (bar: number, track = 'melody') => ({ track, motif: 'theme', bar,
    ...(chamber && track === 'melody' ? { articulation: 'legato' } : {}) });
  return {
    version: 1, id, style, bpm: chamber ? 82 : 98, key: chamber ? 'G major' : 'Eb major', loop: false,
    motifs: {
      theme,
      answer: [{ beat: 0.24, degree: 4, octave: 4, duration: 0.64, velocity: 0.57 },
        { beat: 1.13, degree: 3, octave: 4, duration: 0.55, velocity: 0.60 },
        { beat: 1.96, degree: 2, octave: 4, duration: 1.35, velocity: 0.54 }],
      bridge: [{ beat: 3.1, degree: chamber ? 1 : 3, octave: chamber ? 4 : 3, duration: 1.46, velocity: 0.48 }],
      cadence: [{ beat: 0.16, degree: 1, octave: chamber ? 3 : 4, duration: 2.74, velocity: 0.58 }],
    },
    sections: [
      { id: 'opening', role: 'intro', chords: chamber ? ['Iadd9', 'Iadd9', 'IVmaj7', 'Vsus4'] : ['Imaj9', 'vim9', 'iim9', 'V13'],
        statements: [phrase(1), phrase(3), { track: 'answer', motif: 'answer', bar: 2 },
          { track: 'answer', motif: 'bridge', bar: 4, carry: true }] },
      { id: 'development', role: 'main', chords: chamber ? ['I', 'vi7', 'ii7', 'V7'] : ['Imaj9', 'iii7', 'vim9', 'V13'],
        statements: [phrase(1, 'answer'), { track: 'melody', motif: 'answer', bar: 2 },
          { track: 'answer', motif: 'answer', bar: 3 }, { track: 'melody', motif: 'answer', bar: 4, strength: 0.82 }] },
      { id: 'return', role: 'outro', chords: chamber ? ['Iadd9', 'IVmaj7', 'Vsus4', 'I'] : ['Imaj9', 'iim9', 'V13', 'Imaj9'],
        statements: [{ ...phrase(1), strength: 0.9 }, { track: 'melody', motif: 'answer', bar: 2, strength: 0.82 },
          { track: 'melody', motif: 'cadence', bar: 4 }] },
    ],
  };
}

export function musicPlanTemplate(style: NonNullable<ComposeMusicOptions['style']>, id: string) {
  if (style === 'chamber' || style === 'groove') return ensembleTemplate(style, id);
  const cinematic = style === 'cinematic';
  const lead = cinematic ? 'piano' : 'melody';
  return {
    version: 1, id, style, bpm: 96, key: 'D minor', loop: false,
    motifs: {
      theme: [
        { beat: 0.35, degree: 5, octave: 3, duration: 0.61, velocity: 0.58 },
        { beat: 1.08, degree: 1, octave: 4, duration: 0.52, velocity: 0.66 },
        { beat: 1.78, degree: 2, octave: 4, duration: 0.54, velocity: 0.61 },
        { beat: 2.48, degree: 3, octave: 4, duration: 1.14, velocity: 0.7 },
      ],
    },
    sections: [
      { id: 'opening', role: 'intro', chords: ['i', '@pivot'], statements: [{ track: lead, motif: 'theme' }] },
      { id: 'answer', role: 'main', key: 'F major', chords: ['I', '@dominant'],
        statements: [{ track: cinematic ? 'horn' : lead, motif: 'theme', strength: 0.91 }] },
      { id: 'home', role: 'outro', key: 'D minor', chords: ['i', 'i'],
        statements: [{ track: lead, motif: 'theme', stretch: 1.45, strength: 0.76 }] },
    ],
    ...(cinematic ? { mix: { piano: { pedal: [[0, 1], [3.9, 0], [16.25, 1], [23.75, 0]] } } } : {}),
  };
}
