import { noteEnvelope } from './instruments.ts';
import { pedalRelease } from './pedal.ts';
import type { DrumSound, MusicTrack } from './score.ts';
import { midiHz, noteMidi } from './theory.ts';

export function scheduleNotes(track: MusicTrack, rate: number, framesPerBeat: number, beats: number, loop: boolean) {
  const scoreFrames = Math.round(beats * framesPerBeat);
  const notes = track.notes.filter(note => note.velocity > 0).map(note => {
    const voice = track.instrument === 'drums' ? note.note as DrumSound : track.instrument;
    const start = Math.min(scoreFrames - 1, Math.round(note.beat * framesPerBeat));
    const endBeat = note.beat + note.duration;
    const written = Math.max(1, Math.round(endBeat * framesPerBeat) - start);
    const { envelope, hold } = noteEnvelope(voice, note.articulation, rate, written);
    const midi = track.instrument === 'drums' ? 0 : typeof note.note === 'string' ? noteMidi(note.note) : note.note;
    return { ...note, voice, start, midi, envelope, hold, endBeat: hold === written ? endBeat : (start + hold) / framesPerBeat,
      length: hold + Math.max(1, Math.round(envelope.release * rate)) + 1, fromHz: undefined as number | undefined };
  });
  if (track.pedal) {
    const ordered = [...notes].sort((a, b) => a.start - b.start);
    const nextStrike = new Map<number, number>();
    if (loop) for (const note of ordered) {
      if (!nextStrike.has(note.midi)) nextStrike.set(note.midi, scoreFrames + note.start);
    }
    for (let i = ordered.length - 1; i >= 0; i--) {
      const note = ordered[i];
      const lifted = Math.round(pedalRelease(track.pedal, beats, loop, note.endBeat) * framesPerBeat);
      const end = Math.min(lifted, nextStrike.get(note.midi) ?? Infinity);
      nextStrike.set(note.midi, note.start);
      if (end > note.start + note.hold) {
        const extra = end - note.start - note.hold;
        note.hold += extra;
        note.length += extra;
      }
    }
  }
  if (notes.some(note => note.articulation === 'legato')) {
    const ordered = [...notes].sort((a, b) => a.start - b.start);
    const maxGap = Math.round(rate * 0.048);
    for (const [i, note] of ordered.entries()) {
      if (note.articulation !== 'legato') continue;
      const previous = ordered[i - 1];
      const eligible = previous && previous.start < note.start && ordered[i + 1]?.start !== note.start &&
        ordered[i - 2]?.start !== previous.start && previous.articulation !== 'short' &&
        Math.abs(previous.start + previous.hold - note.start) <= maxGap;
      if (!eligible) {
        note.envelope = noteEnvelope(note.voice, undefined, rate, note.hold).envelope;
        continue;
      }
      note.fromHz = midiHz(previous.midi);
      previous.envelope = { ...previous.envelope, release: Math.min(previous.envelope.release, 0.065) };
      previous.length = previous.hold + Math.round(previous.envelope.release * rate) + 1;
    }
  }
  return notes;
}
