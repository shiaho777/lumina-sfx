import { clamp, dbToGain } from './dsp.ts';
import { resolveMixRole } from './levels.ts';
import { masterAudio, type StereoPcm } from './master.ts';
import { measureLoudness, samplePeakDb } from './meter.ts';
import type { MusicStart } from './music/adaptive.ts';
import { renderMusic } from './music/render.ts';
import { maxMusicSeconds, studioSampleRate } from './music/score.ts';
import { renderWithTiming } from './render.ts';
import type { SoundRecipe } from './types.ts';

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error(path + ' must be an object');
  return value as Record<string, unknown>;
}

function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw Error(path + ' must be between ' + min + ' and ' + max);
  }
  return value;
}

export function readAudioPreview(input: unknown) {
  const data = object(input, 'Preview');
  if (data.version !== 1) throw Error('Preview.version must be 1');
  if (typeof data.id !== 'string' || data.id.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(data.id)) throw Error('Preview.id must be a valid lowercase filename');
  const music = data.music === undefined ? undefined : object(data.music, 'Preview.music');
  const score = music?.score;
  if (music && (typeof score !== 'string' || !score.trim())) throw Error('Preview.music.score must be a local score path');
  const events = data.sfx ?? [];
  if (!Array.isArray(events) || events.length > 256) throw Error('Preview.sfx must be an array of up to 256 events');
  if (!music && !events.length) throw Error('Preview needs music or at least one sound');
  if (!music && data.durationSec === undefined) throw Error('Preview.durationSec is required for an effects-only preview');
  const durationSec = data.durationSec === undefined ? undefined : number(data.durationSec, 'Preview.durationSec', 0.05, maxMusicSeconds);
  const ceilingDbtp = number(data.ceilingDbtp ?? -1, 'Preview.ceilingDbtp', -12, -0.1);
  const musicGainDb = number(music?.gainDb ?? -8, 'Preview.music.gainDb', -90, 12);
  const sfx = events.map((input, i) => {
    const path = 'Preview.sfx[' + i + ']';
    const event = object(input, path);
    const { id, design, alignMarker } = event;
    if ((id === undefined) === (design === undefined)) throw Error(path + ' must use one catalog id or design file');
    if (id !== undefined && (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
      throw Error(path + '.id must be a catalog recipe ID');
    }
    if (design !== undefined && (typeof design !== 'string' || !design.trim().endsWith('.json'))) {
      throw Error(path + '.design must be a local design JSON file');
    }
    if (alignMarker !== undefined && (typeof alignMarker !== 'string' || !alignMarker.trim())) {
      throw Error(path + '.alignMarker must name an authored sound marker');
    }
    if (event.atSec !== undefined && event.atBeat !== undefined) throw Error(path + ' must use one time unit');
    if (event.atBeat !== undefined && !music) throw Error(path + '.atBeat needs a music score');
    const atSec = number(event.atSec ?? 0, path + '.atSec', 0, maxMusicSeconds);
    const atBeat = event.atBeat === undefined ? undefined : number(event.atBeat, path + '.atBeat', 0, 3072);
    const gainDb = number(event.gainDb ?? 0, path + '.gainDb', -90, 12);
    const pan = number(event.pan ?? 0, path + '.pan', -1, 1);
    const duckMusicDb = number(event.duckMusicDb ?? 0, path + '.duckMusicDb', 0, 24);
    if (duckMusicDb && !music) throw Error(path + '.duckMusicDb needs a music score');
    const durationSec = event.durationSec === undefined ? undefined : number(event.durationSec, path + '.durationSec', 0.01, maxMusicSeconds);
    const seed = event.seed === undefined ? undefined : number(event.seed, path + '.seed', 0, 0xffffffff);
    if (seed !== undefined && !Number.isInteger(seed)) throw Error(path + '.seed must be an integer');
    const params = event.params === undefined ? undefined : object(event.params, path + '.params');
    const source = typeof design === 'string' ? { design: design.trim() } : { id: id as string };
    return { ...source, atSec, atBeat, gainDb, pan, duckMusicDb, durationSec, seed, params, alignMarker };
  });
  return { id: data.id, music: typeof score === 'string' ? { score, gainDb: musicGainDb } : undefined, sfx, durationSec, ceilingDbtp };
}

type AudioPreview = ReturnType<typeof readAudioPreview>;

export interface PreviewMusicTrack {
  id: string;
  bpm: number;
  beats: number;
  loop: boolean;
  rate: number;
  frames: number;
  channels: StereoPcm;
  timeline?: readonly MusicStart[];
}

function renderScore(input: unknown, sources: ReadonlyMap<string, SoundRecipe>): PreviewMusicTrack {
  const { score, report, channels } = renderMusic(input, { recipes: sources });
  return { id: score.id, bpm: score.bpm, beats: score.bars * score.beatsPerBar, loop: score.loop,
    rate: report.sampleRate, frames: report.frames, channels };
}

function stereo(frames: number): StereoPcm {
  return [new Float32Array(frames), new Float32Array(frames)];
}

function routeDuck(envelope: Float32Array, start: number, end: number, reduction: number, rate: number) {
  const attack = Math.round(rate * 0.035), release = Math.round(rate * 0.180);
  for (let i = Math.max(0, start - attack); i < Math.min(envelope.length, end + release); i++) {
    const amount = i < start ? (i - start + attack) / attack : i < end ? 1 : 1 - (i - end) / release;
    envelope[i] = Math.max(envelope[i], amount * reduction);
  }
}

export function renderAudioPreview(
  preview: AudioPreview, inputScore: unknown, sources: ReadonlyMap<string, SoundRecipe>, prepared?: PreviewMusicTrack,
) {
  const music = preview.music ? prepared ?? renderScore(inputScore, sources) : undefined;
  const rate = music?.rate ?? studioSampleRate;
  const frames = preview.durationSec === undefined && music ? music.frames : Math.round(preview.durationSec! * rate);
  const musicBus = stereo(frames), sfxBus = stereo(frames);
  const duck = new Float32Array(frames);
  const attack = Math.round(0.012 * rate);
  let maxDuckDb = 0;
  const events = preview.sfx.map(event => {
    const source = event.design ?? event.id;
    const recipe = sources.get(source);
    if (!recipe) throw Error('Unknown sound recipe or design: ' + source);
    if (event.atBeat !== undefined && music && event.atBeat >= music.beats && !music.loop) {
      throw Error(recipe.id + ' is scheduled after the last score beat');
    }
    const atSec = event.atBeat === undefined ? event.atSec : event.atBeat * 60 / music!.bpm;
    const atFrame = Math.round(atSec * rate);
    if (atFrame >= frames) throw Error(recipe.id + ' is scheduled outside the preview');
    let markerFrame = 0;
    if (event.alignMarker !== undefined) {
      const marker = recipe.markers?.[event.alignMarker];
      if (marker === undefined || !Number.isFinite(marker) || marker < 0) {
        const available = Object.keys(recipe.markers ?? {});
        throw Error(recipe.id + ' has no marker ' + event.alignMarker + (available.length ? '. Available: ' + available.join(', ') : ''));
      }
      markerFrame = Math.round(marker * rate / (recipe.macros?.speed ?? 1));
    }
    const params: Record<string, number> = {};
    for (const [id, value] of Object.entries(event.params ?? {})) {
      if (!Object.hasOwn(recipe.params, id)) throw Error(recipe.id + ' has no parameter ' + id);
      const spec = recipe.params[id];
      params[id] = number(value, recipe.id + '.' + id, spec.min, spec.max);
    }
    const { channels: pcm, sourceStartFrame } = renderWithTiming(recipe, { level: 'balanced', seed: event.seed, params }, rate);
    const markerOffset = event.alignMarker === undefined ? 0 : markerFrame - sourceStartFrame;
    const start = atFrame - markerOffset;
    if (start < 0) throw Error(recipe.id + ' is scheduled before the preview');
    const natural = pcm[0].length;
    const requested = event.durationSec === undefined ? natural : Math.round(event.durationSec * rate);
    if (!recipe.loopable && requested > natural + 1) throw Error(recipe.id + ' is a one-shot. Duration may crop it or be omitted');
    const length = Math.min(requested, frames - start, recipe.loopable ? Infinity : natural);
    if (event.alignMarker !== undefined && (markerOffset < 0 || markerOffset >= length)) {
      throw Error(recipe.id + ' is cropped past marker ' + event.alignMarker);
    }
    const gain = dbToGain(event.gainDb);
    const fade = Math.min(attack, Math.max(1, length >> 1));
    const angle = (event.pan + 1) * Math.PI / 4;
    const pan = pcm.length === 1 ? [Math.cos(angle), Math.sin(angle)] :
      [Math.min(1, Math.cos(angle) * Math.SQRT2), Math.min(1, Math.sin(angle) * Math.SQRT2)];
    for (let i = 0; i < length; i++) {
      const onset = recipe.loopable ? Math.min(1, i / fade) : 1;
      const ending = recipe.loopable || length < natural ? Math.min(1, (length - 1 - i) / fade) : 1;
      const multiplier = gain * Math.min(onset, ending);
      for (let c = 0; c < 2; c++) sfxBus[c][start + i] += (pcm[c] ?? pcm[0])[i % natural] * multiplier * pan[c];
    }
    if (event.duckMusicDb > 0) {
      routeDuck(duck, start, start + length, event.duckMusicDb, rate);
      maxDuckDb = Math.max(maxDuckDb, event.duckMusicDb);
    }
    return {
      id: recipe.id, role: resolveMixRole(recipe), startFrame: start, endFrame: start + length,
      ...(event.design ? { design: event.design } : {}),
      ...(event.alignMarker !== undefined ? { marker: { name: event.alignMarker, frame: atFrame } } : {}),
      gainDb: event.gainDb, duckMusicDb: event.duckMusicDb,
      credits: [recipe.recording, ...(recipe.additionalRecordings ?? [])].filter(Boolean),
    };
  });
  if (music) {
    const length = music.frames;
    const gain = dbToGain(preview.music!.gainDb);
    const endFade = frames < length || music.loop;
    for (let i = 0; i < frames && (music.loop || i < length); i++) {
      const ending = endFade ? clamp((frames - 1 - i) / attack, 0, 1) : 1;
      const level = gain * (duck[i] ? dbToGain(-duck[i]) : 1) * ending;
      musicBus[0][i] = music.channels[0][i % length] * level;
      musicBus[1][i] = music.channels[1][i % length] * level;
    }
  }
  const mix = stereo(frames);
  for (let i = 0; i < frames; i++) {
    mix[0][i] = musicBus[0][i] + sfxBus[0][i];
    mix[1][i] = musicBus[1][i] + sfxBus[1][i];
  }
  const { targetLufs: _, ...master } = masterAudio(mix,
    { master: { targetLufs: -18, ceilingDbtp: preview.ceilingDbtp }, loop: false }, rate, false);
  const level = (bus: StereoPcm) => {
    const lufs = measureLoudness(bus, rate).integrated;
    return { integratedLufs: Number.isFinite(lufs) ? Number(lufs.toFixed(3)) : null, samplePeakDbfs: Number(samplePeakDb(bus).toFixed(3)) };
  };
  return {
    mix, musicBus, sfxBus,
    report: {
      id: preview.id, sampleRate: rate, bitDepth: 24, frames, durationSec: frames / rate, maxDuckDb, master,
      music: music ? { id: music.id, gainDb: preview.music!.gainDb, ...level(musicBus),
        ...(music.timeline ? { timeline: music.timeline } : {}) } : null,
      sfx: level(sfxBus), events,
    },
  };
}
