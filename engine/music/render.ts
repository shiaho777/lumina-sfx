import { readAutomation } from './automation.ts';
import { masterAudio, roundMeasurement as round, scaleStereo, type StereoPcm } from '../master.ts';
import { analyzeSpectrum, analyzeStereo, samplePeakDb } from '../meter.ts';
import { adsrCurve, clamp, dbToGain, gainToDb, panGains } from './dsp.ts';
import { createVoice } from './instruments.ts';
import { addPianoResonance } from './pedal.ts';
import { scheduleNotes } from './performance.ts';
import { applyRoom, roomTailFrames } from './room.ts';
import { maxMusicSeconds, musicSampleRate, readMusicScore, studioSampleRate } from './score.ts';
import { midiHz } from './theory.ts';

export { masterAudio, type StereoPcm } from '../master.ts';

export interface MusicRenderOptions {
  onStem?: (id: string, channels: StereoPcm) => void;
  normalize?: boolean;
}

function rms(channels: StereoPcm, from = 0, to = channels[0].length): number {
  let energy = 0;
  for (const channel of channels) for (let i = from; i < to; i++) energy += channel[i] ** 2;
  return gainToDb(Math.sqrt(energy / (2 * Math.max(1, to - from))));
}

export function prepareMusicRender(input: unknown) {
  const score = readMusicScore(input);
  const studio = score.quality === 'studio';
  const rate = studio ? studioSampleRate : musicSampleRate;
  const framesPerBeat = rate * 60 / score.bpm;
  const totalBeats = score.bars * score.beatsPerBar;
  const scoreFrames = Math.round(totalBeats * framesPerBeat);
  const room = score.room ?? 'hall';
  const scheduled = score.tracks.map(track => scheduleNotes(track, rate, framesPerBeat, totalBeats, score.loop));
  let frames = scoreFrames;
  if (!score.loop) {
    for (const [i, notes] of scheduled.entries()) {
      const tail = score.tracks[i].reverb ? roomTailFrames(room, rate) : 0;
      for (const note of notes) frames = Math.max(frames, note.start + note.length + tail);
    }
    if (frames > maxMusicSeconds * rate) throw Error('Score and release tails exceed ' + maxMusicSeconds + ' seconds');
  }
  return { score, studio, rate, framesPerBeat, totalBeats, scoreFrames, room, scheduled, frames };
}

export function renderMusic(input: unknown, options: MusicRenderOptions = {}) {
  return renderPreparedMusic(prepareMusicRender(input), options);
}

export function renderPreparedMusic(prepared: ReturnType<typeof prepareMusicRender>, options: MusicRenderOptions = {}) {
  const { score, studio, rate, framesPerBeat, totalBeats, scoreFrames, room, scheduled, frames } = prepared;
  const mix: StereoPcm = [new Float32Array(frames), new Float32Array(frames)];
  const tracks = score.tracks.map((track, trackIndex) => {
    const stem: StereoPcm = [new Float32Array(frames), new Float32Array(frames)];
    let seed = score.seed ^ 2166136261;
    for (const char of track.id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
    const trackGain = dbToGain(track.gainDb);
    const expression = track.expression && readAutomation(track.expression, totalBeats, score.loop);
    for (const [eventIndex, note] of scheduled[trackIndex].entries()) {
      const { attack, decay, sustain, release } = note.envelope;
      const envelope = adsrCurve(note.length, rate, note.hold, attack, decay, sustain, release);
      const pressure = track.dynamics && readAutomation(track.dynamics, totalBeats, score.loop);
      const synth = createVoice(note.voice, rate, midiHz(note.midi), seed ^ Math.imul(eventIndex + 1, 2654435761), {
        velocity: note.velocity, articulation: note.articulation, studio, fromHz: note.fromHz,
        dynamics: pressure ? time => pressure(note.start / framesPerBeat + time * score.bpm / 60) : undefined,
      });
      const spread = track.instrument === 'pad' || track.instrument === 'strings' ? ((note.midi % 5) - 2) * 0.15 : 0;
      const pan = clamp(track.pan + spread * (1 - Math.abs(track.pan)), -1, 1);
      const [leftGain, rightGain] = panGains(pan).map(gain => gain * trackGain * note.velocity);
      let position = note.start;
      for (let i = 0; i < envelope.length; i++) {
        const sample = synth(i / rate) * envelope[i];
        stem[0][position] += sample * leftGain;
        stem[1][position] += sample * rightGain;
        position = position + 1 === frames ? 0 : position + 1;
      }
    }
    if (studio && track.pedal) addPianoResonance(stem, track.pedal, scheduled[trackIndex].map(note => note.midi),
      { rate, framesPerBeat, beats: totalBeats, loop: score.loop });
    if (expression) {
      for (let i = 0; i < frames; i++) {
        const gain = expression(i / framesPerBeat);
        stem[0][i] *= gain;
        stem[1][i] *= gain;
      }
    }
    if (track.reverb && scheduled[trackIndex].length) applyRoom(stem[0], stem[1], rate, room, track.reverb, score.loop);
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
    return { id: track.id, instrument: track.instrument, notes: track.notes.length, rmsDbfs, samplePeakDbfs: round(peak), wavTrimDb: round(wavTrimDb) };
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
