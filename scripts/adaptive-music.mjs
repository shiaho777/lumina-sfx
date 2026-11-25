import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { compileAdaptiveMusic, inspectAdaptiveMusic } from '../engine/music/adaptive-render.ts';
import { musicObject } from '../engine/music/adaptive.ts';
import { readMusicSource } from '../engine/music/plan.ts';
import { encodeWav } from '../engine/wav.ts';
import { digest, publishAudioProject } from './audio-export.mjs';
import { loadMusicRecipes } from './recipes.mjs';

async function readAdaptiveSource(file, input) {
  const spec = musicObject(input, 'Adaptive');
  if (typeof spec.score !== 'string' || !spec.score.trim()) throw Error('Adaptive.score must name a local score or plan JSON');
  const source = JSON.parse(await readFile(resolve(dirname(file), spec.score), 'utf8'));
  return readMusicSource(source);
}

export async function loadAdaptiveMusic(file, input) {
  const score = await readAdaptiveSource(file, input);
  return compileAdaptiveMusic(input, score, await loadMusicRecipes(score));
}

export async function inspectAdaptiveSource(file, input) {
  const score = await readAdaptiveSource(file, input);
  return inspectAdaptiveMusic(input, score, await loadMusicRecipes(score));
}

export async function publishAdaptiveMusic(filename, destination) {
  const file = resolve(filename);
  const input = JSON.parse(await readFile(file, 'utf8'));
  const { bank, pcm, sharedGainDb, session, sources } = await loadAdaptiveMusic(file, input);
  const runtime = await Promise.all(['adaptive.ts', 'adaptive-player.ts'].map(async name => ({
    name, contents: await readFile(new URL('../engine/music/' + name, import.meta.url)),
  })));
  const { project, assets } = await publishAudioProject(destination, bank.id, write => {
    const wav = (name, channels) => write(name, Buffer.from(encodeWav(channels, bank.sampleRate, {
      bits: 24, ditherSeed: Number.parseInt(digest(name).slice(0, 8), 16),
    })));
    const manifest = write('manifest.json', JSON.stringify(bank, null, 2) + '\n');
    const sections = Object.fromEntries(Object.entries(bank.clips).map(([id, clip]) => [id, wav(clip.file, pcm.get(id))]));
    const player = runtime.map(({ name, contents }) => write(name, contents));
    const preview = session ? wav('preview.wav', session.channels) : undefined;
    const report = write('report.json', JSON.stringify({
      id: bank.id, bpm: bank.bpm, sampleRate: bank.sampleRate, bitDepth: 24, sharedGainDb,
      ...(sources.length ? { sources } : {}),
      ...(session && { frames: session.frames, durationSec: session.durationSec, master: session.master, timeline: session.timeline }),
      files: { manifest, sections, player, ...(preview && { preview }) },
    }, null, 2) + '\n');
    return { manifest, report, preview };
  });
  return {
    directory: project, manifest: join(project, assets.manifest.file), player: join(project, 'adaptive-player.ts'),
    report: join(project, assets.report.file), ...(assets.preview && { preview: join(project, assets.preview.file) }),
  };
}
