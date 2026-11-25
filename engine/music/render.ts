import { readAutomation } from './automation.ts';
import { masterAudio, roundMeasurement as round, scaleStereo, type StereoPcm } from '../master.ts';
import { analyzeSpectrum, analyzeStereo, samplePeakDb } from '../meter.ts';
import type { SoundRecipe } from '../types.ts';
import { clamp, dbToGain, gainToDb, panGains } from './dsp.ts';
import { createVoice } from './instruments.ts';
import { studioElectricPickup, studioGuitarAmp } from './keys-and-strings.ts';
import { addPianoResonance } from './pedal.ts';
import { performanceEnvelope, scheduleNotes } from './performance.ts';
import { prepareRecipePart, renderRecipePart } from './recipe-part.ts';
import { applyRoom, roomTailFrames } from './room.ts';
import { maxMusicSeconds, musicSampleRate, readMusicScore, studioSampleRate } from './score.ts';
import { midiHz } from './theory.ts';

export { masterAudio, type StereoPcm } from '../master.ts';

export interface MusicRenderOptions {
  onStem?: (id: string, channels: StereoPcm) => void;
  normalize?: boolean;
  recipes?: ReadonlyMap<string, SoundRecipe>;
}

function rms(channels: StereoPcm, from = 0, to = channels[0].length): number {
  let energy = 0;
  for (const channel of channels) for (let i = from; i < to; i++) energy += channel[i] ** 2;
  return gainToDb(Math.sqrt(energy / (2 * Math.max(1, to - from))));
}

function hashText(seed: number, key: string) {
  for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return seed;
}

export function prepareMusicRender(input: unknown, recipes?: MusicRenderOptions['recipes'], beatOffset = 0) {
  const score = readMusicScore(input);
  const studio = score.quality === 'studio';
  const rate = studio ? studioSampleRate : musicSampleRate;
  const framesPerBeat = rate * 60 / score.bpm;
  const totalBeats = score.bars * score.beatsPerBar;
  const scoreFrames = Math.round(totalBeats * framesPerBeat);
  const room = score.room ?? 'hall';
  const parts = score.tracks.map(track => track.instrument === 'recipe' ? prepareRecipePart(track, recipes, rate, framesPerBeat, scoreFrames) :
    { recipe: undefined, notes: scheduleNotes(track, rate, framesPerBeat, totalBeats, score.loop, studio) });
  let frames = scoreFrames;
  if (!score.loop) {
    for (const [i, { notes }] of parts.entries()) {
      const tail = score.tracks[i].reverb ? roomTailFrames(room, rate) : 0;
      for (const note of notes) frames = Math.max(frames, note.start + note.length + tail);
    }
    if (frames > maxMusicSeconds * rate) throw Error('Score and release tails exceed ' + maxMusicSeconds + ' seconds');
  }
  return { score, studio, rate, framesPerBeat, totalBeats, scoreFrames, room, parts, frames, beatOffset };
}

export function renderMusic(input: unknown, options: MusicRenderOptions = {}) {
  return renderPreparedMusic(prepareMusicRender(input, options.recipes), options);
}

export function renderPreparedMusic(prepared: ReturnType<typeof prepareMusicRender>, options: MusicRenderOptions = {}) {
  const { score, studio, rate, framesPerBeat, totalBeats, scoreFrames, room, parts, frames, beatOffset } = prepared;
  const mix: StereoPcm = [new Float32Array(frames), new Float32Array(frames)];
  const tracks = score.tracks.map((track, trackIndex) => {
    const stem: StereoPcm = [new Float32Array(frames), new Float32Array(frames)];
    const seed = hashText(score.seed ^ 2166136261, track.id);
    const trackGain = dbToGain(track.gainDb);
    const expression = track.expression && readAutomation(track.expression, totalBeats, score.loop);
    const part = parts[trackIndex];
    if (part.recipe) {
      renderRecipePart(stem, track, part, rate, seed, trackGain);
    } else {
      const sharedAmp = studio && track.instrument === 'electric-guitar';
      const onsets = studio ? new Map<string, number>() : undefined;
      for (const [eventIndex, note] of part.notes.entries()) {
        const envelope = performanceEnvelope(note, rate, studio);
        const pressure = track.dynamics && readAutomation(track.dynamics, totalBeats, score.loop);
        const hz = midiHz(note.midi);
        let noteSeed = seed ^ Math.imul(eventIndex + 1, 2654435761);
        if (onsets) {
          const onset = Math.round((note.beat + beatOffset) * 1_000_000);
          const key = note.voice + '/' + onset + '/' + note.midi;
          const unison = onsets.get(key) ?? 0;
          onsets.set(key, unison + 1);
          noteSeed = hashText(seed, key) ^ Math.imul(unison, 2654435761);
        }
        const synth = sharedAmp ? studioElectricPickup(rate, hz, noteSeed, note.velocity, note.articulation) :
          createVoice(note.voice, rate, hz, noteSeed, {
            velocity: note.velocity, articulation: note.articulation, studio, fromHz: note.fromHz, gateSeconds: note.hold / rate,
            dynamics: pressure ? time => pressure(note.start / framesPerBeat + time * score.bpm / 60) : undefined,
          });
        const spread = track.instrument === 'pad' || track.instrument === 'strings' ? ((note.midi % 5) - 2) * 0.15 : 0;
        const pan = clamp(track.pan + spread * (1 - Math.abs(track.pan)), -1, 1);
        const [leftGain, rightGain] = sharedAmp ? [note.velocity, 0] : panGains(pan).map(gain => gain * trackGain * note.velocity);
        let position = note.start;
        for (let i = 0; i < envelope.length; i++) {
          const sample = synth(i / rate) * envelope[i];
          stem[0][position] += sample * leftGain;
          stem[1][position] += sample * rightGain;
          position = position + 1 === frames ? 0 : position + 1;
        }
      }
      if (sharedAmp && part.notes.length) {
        const amp = studioGuitarAmp(rate);
        const [leftGain, rightGain] = panGains(track.pan).map(gain => gain * trackGain);
        const [pickup, right] = stem;
        if (score.loop) {
          const first = Math.max(0, frames - Math.round(rate * 0.12));
          for (let i = first; i < frames; i++) amp(pickup[i]);
        }
        for (let i = 0; i < frames; i++) {
          const sample = amp(pickup[i]);
          pickup[i] = sample * leftGain;
          right[i] = sample * rightGain;
        }
      }
      if (studio && track.pedal) addPianoResonance(stem, track.pedal, part.notes.map(note => note.midi),
        { rate, framesPerBeat, beats: totalBeats, loop: score.loop });
    }
    if (expression) {
      for (let i = 0; i < frames; i++) {
        const gain = expression(i / framesPerBeat);
        stem[0][i] *= gain;
        stem[1][i] *= gain;
      }
    }
    if (track.reverb && part.notes.length) applyRoom(stem[0], stem[1], rate, room, track.reverb, score.loop);
    for (let i = 0; i < frames; i++) {
      mix[0][i] += stem[0][i];
      mix[1][i] += stem[1][i];
    }
    const peak = samplePeakDb(stem);
    const wavTrimDb = Math.min(0, -0.05 - peak);
    const rmsDbfs = round(rms(stem));
    if (options.onStem) {
      scaleStereo(stem, dbToGain(wavTrimDb));
      options.onStem(track.id, stem);
    }
    const source = part.recipe && { recipe: part.recipe.id,
      credits: [part.recipe.recording, ...(part.recipe.additionalRecordings ?? [])].filter(Boolean) };
    return { id: track.id, instrument: track.instrument, notes: track.notes.length, rmsDbfs, samplePeakDbfs: round(peak), wavTrimDb: round(wavTrimDb),
      ...(source ? { source } : {}) };
  });

  const master = masterAudio(mix, score, rate, options.normalize ?? true);
  const region = Math.min(Math.round(0.025 * rate), Math.floor(frames / 2));
  const seam = score.loop ? {
    startRmsDbfs: round(rms(mix, 0, region)),
    endRmsDbfs: round(rms(mix, frames - region, frames)),
    boundaryJumpDbfs: round(gainToDb(Math.max(...mix.map(channel => Math.abs(channel[0] - channel[frames - 1]))))),
  } : null;
  const bars = Array.from({ length: score.bars }, (_, i) => {
    const start = Math.round(i * score.beatsPerBar * framesPerBeat);
    const end = Math.round((i + 1) * score.beatsPerBar * framesPerBeat);
    return { bar: i + 1, startFrame: start, rmsDbfs: round(rms(mix, start, end)) };
  });
  let sectionBar = 0;
  const sections = score.sections?.map(section => {
    const startBar = sectionBar + 1;
    const startFrame = bars[sectionBar].startFrame;
    sectionBar += section.bars;
    const endFrame = bars[sectionBar]?.startFrame ?? scoreFrames;
    return {
      ...(section.id ? { id: section.id } : {}), role: section.role, startBar, bars: section.bars, startFrame, endFrame,
      rmsDbfs: round(rms(mix, startFrame, endFrame)), ...(section.key ? { key: section.key } : {}),
      ...(section.chords ? { chords: section.chords } : {}), ...(section.handoff ? { handoff: section.handoff } : {}),
    };
  });
  const stereo = analyzeStereo(...mix);
  const spectrum = analyzeSpectrum(...mix, rate);
  return {
    score,
    channels: mix,
    report: {
      id: score.id,
      sampleRate: rate,
      ...(studio ? { bitDepth: 24 as const } : {}),
      frames,
      durationSec: frames / rate,
      loop: score.loop ? { startFrame: 0, endFrame: frames, ...seam } : null,
      master,
      stereo: { correlation: round(stereo.correlation), midSideDb: round(stereo.midSideDb), monoLossDb: round(stereo.monoLossDb) },
      spectrum: {
        centroidHz: round(spectrum.centroidHz),
        rolloffHz: round(spectrum.rolloffHz),
        bands: spectrum.bands.map(band => ({ centerHz: band.center, rmsDbfs: round(band.db), correlation: round(band.correlation) })),
      },
      tracks,
      bars,
      ...(sections ? { sections } : {}),
    },
  };
}
