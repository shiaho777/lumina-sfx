import {
  type AdaptiveClip, type AdaptiveMusicBank, type MusicChange, type MusicTransition, musicId, musicNumber, musicObject,
  previewMusicTimeline, readAdaptiveBank, readMusicRouting, transitionEnvelope, transitionFor,
} from './adaptive.ts';
import { readAutomation } from './automation.ts';
import { dbToGain, gainToDb } from './dsp.ts';
import { harmonySignature } from './harmony.ts';
import { masterAudio, scaleStereo, type StereoPcm } from '../master.ts';
import { truePeakDb } from '../meter.ts';
import { cropPedal } from './pedal.ts';
import { prepareMusicRender, renderPreparedMusic } from './render.ts';
import { maxMusicSeconds, type AutomationPoint } from './score.ts';
import { parseChord, parseKey } from './theory.ts';

interface MusicRegion {
  id: string;
  start: number;
  beats: number;
  bars: number;
  harmony?: AdaptiveClip['harmony'];
}

function cropCurve(points: AutomationPoint[] | undefined, start: number, end: number, span: number, loop: boolean) {
  if (!points) return undefined;
  const read = readAutomation(points, span, loop);
  return [
    [0, read(start)],
    ...points.filter(([beat]) => beat > start && beat < end).map(([beat, value]) => [beat - start, value]),
    [end - start, read(end)],
  ];
}

function readPreview(value: unknown, routing: ReturnType<typeof readMusicRouting>, bpm: number) {
  const preview = musicObject(value, 'Adaptive.preview');
  const beats = musicNumber(preview.beats, 'Adaptive.preview.beats', 0.05 * bpm / 60, maxMusicSeconds * bpm / 60);
  const events = preview.changes ?? [];
  if (!Array.isArray(events) || events.length > 2048) throw Error('Adaptive.preview.changes must be an array of up to 2048 events');
  const changes = events.map((value, i): MusicChange => {
    const path = 'Adaptive.preview.changes[' + i + ']';
    const change = musicObject(value, path);
    const beat = musicNumber(change.beat, path + '.beat', 0, beats);
    if (beat >= beats) throw Error(path + '.beat must be inside the preview');
    const override = transitionFor(change, routing.defaults, path);
    const options: Partial<MusicTransition> = {};
    if (change.at !== undefined) options.at = override.at;
    if (change.entry !== undefined) options.entry = override.entry;
    if (change.fadeBeats !== undefined) options.fadeBeats = override.fadeBeats;
    if (change.waitBars !== undefined) options.waitBars = override.waitBars;
    if ((change.state === undefined) === (change.intensity === undefined)) throw Error(path + ' needs either state or intensity');
    if (change.state === undefined) return { beat, intensity: musicNumber(change.intensity, path + '.intensity', 0, 1), ...options };
    const state = musicId(change.state, path + '.state');
    if (!Object.hasOwn(routing.states, state)) throw Error('Unknown preview state: ' + state);
    return { beat, state, ...options };
  });
  if (changes.some((change, index) => index > 0 && change.beat < changes[index - 1].beat)) throw Error('Preview changes must be ordered by beat');
  const finish = preview.finish === undefined ? undefined : musicId(preview.finish, 'Adaptive.preview.finish');
  if (finish && !routing.oneShot.includes(finish)) throw Error('Adaptive.preview.finish must be a one-shot state');
  if (preview.keepTail !== undefined && (typeof preview.keepTail !== 'boolean' || !finish)) {
    throw Error('Adaptive.preview.keepTail must be a boolean paired with finish');
  }
  return { beats, changes, finish, keepTail: preview.keepTail !== false };
}

function prepareAdaptiveMusic(input: unknown, inputScore: unknown) {
  const spec = musicObject(input, 'Adaptive');
  if (spec.version !== 1) throw Error('Adaptive.version must be 1');
  const id = musicId(spec.id, 'Adaptive.id');
  const full = prepareMusicRender(inputScore);
  const { score, rate: sampleRate, totalBeats } = full;
  const regions = new Map<string, MusicRegion>();
  let start = 0;
  for (const section of score.sections ?? []) {
    const beats = section.bars * score.beatsPerBar;
    const flats = section.key && parseKey(section.key).flats;
    if (section.id) regions.set(section.id, {
      id: section.id, bars: section.bars, start, beats,
      harmony: section.chords?.map(symbol => ({ ...harmonySignature(parseChord(symbol, Boolean(flats))), chord: symbol })),
    });
    start += beats;
  }
  if (!regions.size) throw Error('Adaptive music needs named sections in the source score or plan');
  const states = musicObject(spec.states, 'Adaptive.states');
  const defaults = musicObject(spec.defaults ?? {}, 'Adaptive.defaults');
  const annotated = Object.values(states).every(id => typeof id === 'string' && regions.get(id)?.harmony);
  const routing = readMusicRouting({ ...spec, defaults: { ...(annotated ? { entry: 'harmonic' } : {}), ...defaults } }, new Set(regions.keys()));
  const preview = spec.preview === undefined ? undefined : readPreview(spec.preview, routing, score.bpm);
  const sections = [...new Set(Object.values(routing.states))].map(name => {
    const region = regions.get(name)!;
    const end = region.start + region.beats;
    const firstFrame = Math.round(region.start * full.framesPerBeat);
    const carried = full.scheduled.map(notes => notes.filter(note =>
      note.beat < region.start && note.start + note.hold > firstFrame));
    const earliest = carried.reduce((first, notes) => notes.reduce((at, note) => Math.min(at, note.beat), first), region.start);
    const preRollBars = Math.ceil((region.start - earliest) / score.beatsPerBar);
    const start = region.start - preRollBars * score.beatsPerBar;
    const segment = prepareMusicRender({
      ...score, id: region.id, loop: false, bars: region.bars + preRollBars, sections: undefined,
      tracks: score.tracks.map((track, index) => ({
        ...track,
        notes: [
          ...carried[index].map(note => ({ ...note, beat: note.beat - start, duration: Math.min(note.duration, end - note.beat) })),
          ...track.notes.filter(note => note.beat >= region.start && note.beat < end).map(note => ({
            ...note, beat: note.beat - start, duration: Math.min(note.duration, region.beats),
          })),
        ],
        dynamics: cropCurve(track.dynamics, start, end, totalBeats, score.loop),
        expression: cropCurve(track.expression, start, end, totalBeats, score.loop),
        pedal: cropPedal(track.pedal, start, end, score.loop),
      })),
    });
    const trim = segment.scoreFrames - Math.round(region.beats * full.framesPerBeat);
    const clip: AdaptiveClip = { file: 'section-' + name + '.wav', frames: segment.frames - trim, beats: region.beats,
      ...(region.harmony ? { harmony: region.harmony } : {}) };
    return { name, segment, clip, trim };
  });
  const bank = readAdaptiveBank({
    version: 1, id, bpm: score.bpm, beatsPerBar: score.beatsPerBar, sampleRate,
    clips: Object.fromEntries(sections.map(({ name, clip }) => [name, clip])), ...routing,
  });
  return { full, bank, sections, preview: preview && prepareRoutingPreview(bank, preview) };
}

function prepareRoutingPreview(bank: AdaptiveMusicBank, preview: ReturnType<typeof readPreview>) {
  if (!preview.finish) return planAdaptivePreview(bank, preview.changes, preview.beats);
  const section = bank.states[preview.finish];
  const clip = bank.clips[section];
  const startBeat = preview.beats - clip.beats;
  if (startBeat < 0 || !Number.isInteger(startBeat / bank.beatsPerBar)) {
    throw Error('Preview needs a complete-bar budget long enough for the closing section');
  }
  if (preview.changes.some(change => change.beat >= startBeat)) throw Error('A preview change overlaps the reserved closing section');
  const endBeat = preview.keepTail ? startBeat + clip.frames * bank.bpm / (bank.sampleRate * 60) : preview.beats;
  if (endBeat * 60 / bank.bpm > maxMusicSeconds) throw Error('Preview and closing tail exceed ' + maxMusicSeconds + ' seconds');
  const plan = planAdaptivePreview(bank, [...preview.changes, {
    beat: startBeat, state: preview.finish, at: 'now', entry: bank.defaults.entry === 'harmonic' ? 'harmonic' : 'start',
  }], endBeat);
  const last = plan.timeline.at(-1);
  if (!last || last.section !== section || Math.abs(last.beat - startBeat) > 1e-7 || last.offsetBeat) {
    throw Error('Could not fit the closing section after the previous transition');
  }
  return plan;
}

export function inspectAdaptiveMusic(input: unknown, inputScore: unknown) {
  const { full, bank, preview } = prepareAdaptiveMusic(input, inputScore);
  return { ...bank, score: full.score.id, ...(preview && { preview }) };
}

export function compileAdaptiveMusic(input: unknown, inputScore: unknown) {
  const { full, bank, sections, preview } = prepareAdaptiveMusic(input, inputScore);
  const { score } = full;
  const { master } = renderPreparedMusic(full).report;
  const pcm = new Map<string, StereoPcm>();
  const preGainPeak: number[] = [];
  for (const { name, segment, trim } of sections) {
    const rendered = renderPreparedMusic(segment, { normalize: false });
    const channels: StereoPcm = trim ? [rendered.channels[0].subarray(trim), rendered.channels[1].subarray(trim)] : rendered.channels;
    pcm.set(name, channels);
    const peak = trim ? truePeakDb(channels) : rendered.report.master.truePeakDbtp;
    preGainPeak.push(peak === null || !Number.isFinite(peak) ? -180 : peak);
  }
  const sharedGainDb = Math.min((master.loudnessGainDb ?? 0) + (master.truePeakTrimDb ?? 0),
    Math.min(-3, score.master.ceilingDbtp - 0.10) - Math.max(...preGainPeak));
  const gain = dbToGain(sharedGainDb);
  for (const channels of pcm.values()) scaleStereo(channels, gain);
  const session = preview && renderPlannedPreview(bank, pcm, preview, score.master.ceilingDbtp);
  return { bank, pcm, score, sharedGainDb, session };
}

function planAdaptivePreview(bank: AdaptiveMusicBank, changes: readonly MusicChange[], beats: number) {
  const framesPerBeat = bank.sampleRate * 60 / bank.bpm;
  const frameAt = (beat: number) => Math.round(beat * framesPerBeat);
  const frames = frameAt(beats);
  const starts = previewMusicTimeline(bank, changes, beats);
  const timeline = starts.map((cue, index) => {
    const shape = transitionEnvelope(bank, starts[index - 1], cue);
    return { ...cue, frame: frameAt(cue.beat), offsetFrame: frameAt(cue.offsetBeat), overlapBeats: shape.overlap,
      ...(cue.handoff ? { fadeBeforeBeats: shape.before, fadeInBeats: shape.after } : {}) };
  });
  return { frames, durationSec: frames / bank.sampleRate, timeline };
}

export function renderAdaptivePreview(
  bank: AdaptiveMusicBank, clips: ReadonlyMap<string, StereoPcm>, changes: readonly MusicChange[], beats: number, ceilingDbtp = -1,
) {
  return renderPlannedPreview(bank, clips, planAdaptivePreview(bank, changes, beats), ceilingDbtp);
}

function renderPlannedPreview(
  bank: AdaptiveMusicBank, clips: ReadonlyMap<string, StereoPcm>, preview: ReturnType<typeof planAdaptivePreview>, ceilingDbtp: number,
) {
  const { frames, durationSec, timeline } = preview;
  const rate = bank.sampleRate;
  const framesPerBeat = rate * 60 / bank.bpm;
  const stereo: StereoPcm = [new Float32Array(frames), new Float32Array(frames)];
  for (const [index, cue] of timeline.entries()) {
    const { frame: start, offsetFrame: offset } = cue;
    const next = timeline[index + 1];
    const incoming = Math.round((cue.fadeInBeats ?? cue.overlapBeats) * framesPerBeat);
    const tail = Math.round((next?.overlapBeats ?? 0) * framesPerBeat);
    const lead = Math.round((next?.fadeBeforeBeats ?? 0) * framesPerBeat);
    const end = next?.frame ?? frames;
    const source = clips.get(cue.section);
    if (!source) throw Error('Missing clip PCM: ' + cue.section);
    const count = Math.min(source[0].length - offset, end + tail - start, frames - start);
    for (let i = 0; i < count; i++) {
      const frame = start + i;
      const rise = incoming ? Math.min(1, i / incoming) : 1;
      const fall = lead && frame >= end - lead ? (end - frame) / lead :
        frame >= end && tail ? Math.max(0, 1 - (frame - end) / tail) : 1;
      const gain = rise * fall;
      stereo[0][frame] += source[0][offset + i] * gain;
      stereo[1][frame] += source[1][offset + i] * gain;
    }
  }
  const ending = Math.min(frames, Math.round(0.015 * rate));
  for (let i = 0; i < ending; i++) {
    const index = frames - 1 - i;
    for (const side of stereo) side[index] *= i / ending;
  }
  const { targetLufs: _, ...master } = masterAudio(stereo, { loop: false, master: { targetLufs: -18, ceilingDbtp } }, rate, false);
  return {
    channels: stereo, master, frames, durationSec,
    timeline: timeline.map(cue => {
      const { frame } = cue;
      const step = frame > 0 && frame < frames ? Math.max(...stereo.map(side => Math.abs(side[frame] - side[frame - 1]))) : null;
      return { ...cue, boundaryJumpDbfs: step === null ? null : Number(gainToDb(step).toFixed(3)) };
    }),
  };
}
