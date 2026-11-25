import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readAudioPreview, renderAudioPreview } from '../engine/project-mix.ts';
import { musicSourceKind, readMusicSource } from '../engine/music/plan.ts';
import { encodeWav } from '../engine/wav.ts';
import { loadAdaptiveMusic } from './adaptive-music.mjs';
import { digest, publishAudioProject } from './audio-export.mjs';
import { loadRecipes } from './recipes.mjs';
import { loadDesign } from './remix-design.mjs';

const usage = `npm run scene:preview -- <preview.json> --dest <directory>
Events can reference a catalog id or a layered design JSON file. Use alignMarker to land a sound marker at atSec or atBeat.`;
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true, options: { dest: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help) console.log(usage);
  else {
    if (positionals.length !== 1 || !values.dest?.trim()) throw Error(usage);
    const file = resolve(positionals[0]);
    const raw = JSON.parse(await readFile(file, 'utf8'));
    const preview = readAudioPreview(raw);
    const sourceFile = preview.music ? resolve(dirname(file), preview.music.score) : undefined;
    const source = sourceFile ? JSON.parse(await readFile(sourceFile, 'utf8')) : undefined;
    const adaptive = musicSourceKind(source) === 'routing' ? await loadAdaptiveMusic(sourceFile, source) : undefined;
    if (adaptive && !adaptive.session) throw Error('The adaptive music source needs a preview timeline');
    const score = sourceFile && !adaptive ? readMusicSource(source) : undefined;
    const prepared = adaptive && {
      id: adaptive.bank.id, bpm: adaptive.bank.bpm, beats: adaptive.session.durationSec * adaptive.bank.bpm / 60,
      loop: false, rate: adaptive.bank.sampleRate, frames: adaptive.session.frames, channels: adaptive.session.channels,
      timeline: adaptive.session.timeline,
    };
    const recipes = await loadRecipes(new Set(preview.sfx.flatMap(event => event.id === undefined ? [] : [event.id])));
    const sources = new Map(recipes.map(recipe => [recipe.id, recipe]));
    for (const event of preview.sfx) {
      if (event.design && !sources.has(event.design)) {
        const { recipe } = await loadDesign(event.design, dirname(file));
        sources.set(event.design, recipe);
      }
    }
    const audio = renderAudioPreview(preview, score, sources, prepared);
    const { project, assets } = await publishAudioProject(values.dest, preview.id, write => {
      const wav = (name, pcm) => write(name, Buffer.from(encodeWav(pcm, audio.report.sampleRate,
        { bits: 24, ditherSeed: Number.parseInt(digest(name).slice(0, 8), 16) })));
      const stem = (name, pcm, peakDb) => {
        const trimDb = Math.min(0, -0.05 - peakDb);
        if (trimDb < 0) {
          const gain = 10 ** (trimDb / 20);
          for (const channel of pcm) for (let i = 0; i < channel.length; i++) channel[i] *= gain;
        }
        return { ...wav(name, pcm), trimDb };
      };
      const files = {
        master: wav('master.wav', audio.mix),
        ...(preview.music ? { music: stem('music.wav', audio.musicBus, audio.report.music.samplePeakDbfs) } : {}),
        ...(preview.sfx.length ? { sfx: stem('sfx.wav', audio.sfxBus, audio.report.sfx.samplePeakDbfs) } : {}),
      };
      const report = write('report.json', JSON.stringify({ ...audio.report, files }, null, 2) + '\n');
      return { ...files, report };
    });
    console.log(JSON.stringify(Object.fromEntries([['directory', project],
      ...Object.entries(assets).map(([id, value]) => [id, join(project, value.file)])]), null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
