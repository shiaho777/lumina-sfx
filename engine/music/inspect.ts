import { harmonySignature } from './harmony.ts';
import { instrumentCatalog, readMusicScore } from './score.ts';
import { midiName, noteMidi, parseChord, parseKey } from './theory.ts';

export function inspectMusic(input: unknown) {
  const score = readMusicScore(input);
  const notes = score.tracks.map(track => track.notes.filter(note => note.velocity > 0));
  const tracks = score.tracks.map((track, i) => {
    const events = notes[i];
    const entry = instrumentCatalog[track.instrument];
    const pitches = 'range' in entry ? events.map(note => typeof note.note === 'number' ? note.note : noteMidi(note.note)) : [];
    const range = 'range' in entry ? entry.range : undefined;
    const outside = range ? pitches.flatMap((pitch, i) => pitch < noteMidi(range[0]) || pitch > noteMidi(range[1]) ?
      [{ beat: events[i].beat, note: midiName(pitch) }] : []) : [];
    const endpoints = events.flatMap(note => [[note.beat, 1], [note.beat + note.duration, -1]])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let sounding = 0, peakWrittenPolyphony = 0;
    for (const [, delta] of endpoints) {
      sounding += delta;
      peakWrittenPolyphony = Math.max(peakWrittenPolyphony, sounding);
    }
    return {
      id: track.id, instrument: track.instrument, notes: events.length, peakWrittenPolyphony,
      pitchRange: pitches.length ? [midiName(Math.min(...pitches)), midiName(Math.max(...pitches))] : undefined,
      outOfRecommendedRange: outside.length,
      ...(outside.length ? { rangeExamples: outside.slice(0, 4) } : {}),
      articulations: [...new Set(events.map(note => note.articulation ?? 'default'))],
      dynamics: track.dynamics?.length ?? 0, expression: track.expression?.length ?? 0,
      ...(track.pedal ? { pedal: track.pedal.length } : {}),
    };
  });
  let start = 0;
  const sections = (score.sections ?? [{ role: 'main', bars: score.bars }]).map(section => {
    const startBeat = start, endBeat = start + section.bars * score.beatsPerBar;
    start = endBeat;
    return {
      ...section, startBeat, endBeat,
      tracks: score.tracks.map((track, i) => ({
        id: track.id, onsets: notes[i].filter(note => note.beat >= startBeat && note.beat < endBeat).length,
        carriedIn: notes[i].filter(note => note.beat < startBeat && note.beat + note.duration > startBeat).length,
      })).filter(track => track.onsets || track.carriedIn),
    };
  });
  const modulations = sections.flatMap((section, i) => {
    const previous = sections[i - 1];
    if (!previous?.key || !section.key || previous.key === section.key) return [];
    const from = parseKey(previous.key), to = parseKey(section.key);
    if (from.tonic === to.tonic && from.scale === to.scale) return [];
    const fromChord = previous.chords?.at(-1), toChord = section.chords?.[0];
    const mask = fromChord && toChord ? harmonySignature(parseChord(fromChord)).mask & harmonySignature(parseChord(toChord)).mask : 0;
    const commonTones = Array.from({ length: 12 }, (_, pitch) => pitch)
      .filter(pitch => mask & (1 << pitch)).map(pitch => midiName(60 + pitch).slice(0, -1));
    return [{
      atBeat: section.startBeat, section: section.id, from: previous.key, to: section.key, fromChord, toChord, commonTones,
      ...(previous.handoff ? { bridge: previous.handoff } : {}),
    }];
  });
  return {
    id: score.id, bpm: score.bpm, key: score.key, bars: score.bars, loop: score.loop,
    durationBeats: score.bars * score.beatsPerBar, tracks, sections, ...(modulations.length ? { modulations } : {}),
  };
}
