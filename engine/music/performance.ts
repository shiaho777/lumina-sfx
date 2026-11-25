import { adsrCurve } from './dsp.ts';
import { noteEnvelope } from './instruments.ts';
import { pedalRelease } from './pedal.ts';
import type { DrumSound, MusicNote, MusicTrack } from './score.ts';
import { midiHz, noteMidi } from './theory.ts';

export function noteWindow(note: MusicNote, framesPerBeat: number, scoreFrames: number) {
  const start = Math.min(scoreFrames - 1, Math.round(note.beat * framesPerBeat));
  const endBeat = note.beat + note.duration;
  const written = Math.max(1, Math.round(endBeat * framesPerBeat) - start);
  return { start, endBeat, written };
}

const legatoFadeSeconds = 0.028;

function phraseEnvelope(voice: Parameters<typeof noteEnvelope>[0], articulation: MusicNote['articulation'], rate: number, frames: number, fit: boolean) {
  const { envelope, hold } = noteEnvelope(voice, articulation, rate, frames);
  if (!fit || articulation === 'swell') return { envelope, hold };
  const seconds = hold / rate;
  return { hold, envelope: {
    ...envelope,
    attack: Math.min(envelope.attack, 0.46 * seconds),
    release: seconds < 0.090 ? Math.min(envelope.release, 0.016 + 0.62 * seconds) : envelope.release,
  } };
}

export function scheduleNotes(track: MusicTrack, rate: number, framesPerBeat: number, beats: number, loop: boolean, studio = false) {
  const instrument = track.instrument;
  if (instrument === 'recipe') throw Error('Recipe notes need a catalog sound');
  const crossfadeLegato = instrument === 'violin' || (studio && (instrument === 'strings' || instrument === 'cello' || instrument === 'horn'));
  const fitPhrase = studio && crossfadeLegato;
  const scoreFrames = Math.round(beats * framesPerBeat);
  const notes = track.notes.filter(note => note.velocity > 0).map(note => {
    const voice = instrument === 'drums' ? note.note as DrumSound : instrument;
    const { start, endBeat, written } = noteWindow(note, framesPerBeat, scoreFrames);
    const { envelope, hold } = phraseEnvelope(voice, note.articulation, rate, written, fitPhrase);
    const midi = track.instrument === 'drums' ? 0 : typeof note.note === 'string' ? noteMidi(note.note) : note.note;
    return { ...note, voice, start, midi, envelope, hold, endBeat: hold === written ? endBeat : (start + hold) / framesPerBeat,
      length: hold + Math.max(1, Math.round(envelope.release * rate)) + 1, fromHz: undefined as number | undefined,
      joinedIn: 0, joinedOut: 0 };
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
  if (fitPhrase || notes.some(note => note.articulation === 'legato')) {
    const ordered = [...notes].sort((a, b) => a.start - b.start);
    const maxGap = Math.round(rate * 0.048);
    const fadeFrames = Math.round(legatoFadeSeconds * rate);
    for (const [i, note] of ordered.entries()) {
      const previous = ordered[i - 1];
      const elapsed = previous ? note.start - previous.start : 0;
      const neighbors = previous && elapsed > 0 && ordered[i + 1]?.start !== note.start &&
        ordered[i - 2]?.start !== previous.start && previous.joinedIn <= elapsed &&
        Math.abs(previous.start + previous.hold - note.start) <= maxGap;
      if (fitPhrase && neighbors && previous.midi === note.midi) {
        const gap = Math.max(0, elapsed - previous.hold) / rate;
        previous.hold = Math.min(previous.hold, elapsed);
        previous.endBeat = (previous.start + previous.hold) / framesPerBeat;
        const release = Math.min(previous.envelope.release, gap + Math.max(0.008, Math.min(0.016, note.hold / (4 * rate))));
        previous.envelope = { ...previous.envelope, release };
        previous.length = previous.hold + Math.max(1, Math.round(release * rate)) + 1;
      }
      if (note.articulation !== 'legato') continue;
      const fade = fitPhrase ? Math.min(fadeFrames, Math.floor(note.hold * 0.47), Math.floor(elapsed * 0.47)) : fadeFrames;
      if (!neighbors || previous.articulation === 'short' ||
          (crossfadeLegato && (previous.midi === note.midi || fade < 1 || note.hold < fade || elapsed < fade))) {
        note.envelope = phraseEnvelope(note.voice, undefined, rate, note.hold, fitPhrase).envelope;
        continue;
      }
      note.fromHz = midiHz(previous.midi);
      if (crossfadeLegato) {
        note.joinedIn = fade;
        note.envelope = { ...note.envelope, attack: fade / rate };
        previous.joinedOut = fade;
        previous.hold = elapsed;
        previous.endBeat = note.start / framesPerBeat;
      }
      const release = crossfadeLegato ? fade / rate : Math.min(previous.envelope.release, 0.065);
      previous.envelope = { ...previous.envelope, release };
      previous.length = previous.hold + Math.round(previous.envelope.release * rate) + 1;
    }
  }
  return notes;
}

export function performanceEnvelope(note: ReturnType<typeof scheduleNotes>[number], rate: number, studio = false) {
  const { attack, decay, sustain, release } = note.envelope;
  const envelope = adsrCurve(note.length, rate, note.hold, attack, decay, sustain, release, studio);
  for (let i = 0; i < note.joinedIn; i++) {
    envelope[i] = Math.sin(Math.PI * i / (2 * note.joinedIn));
  }
  for (let i = 0; i < note.joinedOut; i++) {
    envelope[note.hold + i] = envelope[note.hold - 1] * Math.cos(Math.PI * i / (2 * note.joinedOut));
  }
  return envelope;
}
