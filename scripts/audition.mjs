import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { checkIsolatedRecipes, selectRecipes } from './install-files.mjs';
import { loadDesign } from './remix-design.mjs';
import { loadMusicRecipes, loadRecipes } from './recipes.mjs';
import { renderChannels, SAMPLE_RATE, DEFAULT_SEED } from '../engine/render.ts';
import { measureLevel } from '../engine/levels.ts';
import { measureLoudness } from '../engine/meter.ts';
import { renderMusic } from '../engine/music/render.ts';
import { musicSourceKind, readMusicSource } from '../engine/music/plan.ts';
import { encodeWav } from '../engine/wav.ts';
import { sceneStyles } from '../engine/remix.ts';

const { positionals: inputs, values } = parseArgs({
  allowPositionals: true,
  options: {
    'use-case':{type:'string'}, context:{type:'string'}, clean: { type:'boolean' }, isolated: { type: 'boolean' },
    moods: { type: 'boolean' },
    styles: { type: 'boolean' },
    bed: { type: 'string' },
    out: { type: 'string' },
    at: { type: 'string' },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  console.log(
    'npm run audition -- <recipe-id|design.json|plan.json|score.json> <second> [third] (or one SFX candidate with --styles or --moods) [--at <seconds>] [--clean] [--isolated] [--bed <loop-id>] --out <desk.html>',
  );
  process.exit(0);
}
const performances = new Set(), components = new Set();
function remember(source){
  performances.add(source.id);
  for(const component of source.components??[])components.add(component);
}
if (values.styles && values.moods) throw Error('Compare either styles or moods');
if ((values.styles || values.moods ? inputs.length !== 1 : ![2, 3].includes(inputs.length)) || !values.out)
  throw Error('Choose two or three candidates and an --out HTML file');
const atSec = values.at === undefined ? 0 : Number(values.at);
if (!Number.isFinite(atSec) || atSec < 0 || values.at === '') throw Error('--at must be a nonnegative time in seconds');
async function recipe(id) {
  const [sound] = await loadRecipes(new Set([id]));
  if (!sound) throw Error('Unknown sound: ' + id);
  return sound;
}
async function candidate(input, style, mood) {
  async function group(design, directory) {
    const {recipe, selected} = await loadDesign(design, directory);
    if (values.clean || values.isolated) await checkIsolatedRecipes(selected, {clean:values.clean});
    selected.forEach(remember);
    return recipe;
  }
  const json = input.endsWith('.json') ? JSON.parse(await readFile(input, 'utf8')) : undefined;
  const kind = musicSourceKind(json);
  if (kind === 'routing') throw Error('Use music adaptive to render the routing preview, or audition its source plan');
  if (kind) {
    if (style || mood) throw Error('For music, pass two or three plans or scores');
    const score = readMusicSource(json);
    const recipes = await loadMusicRecipes(score);
    if ((values.clean || values.isolated) && recipes.size)
      await checkIsolatedRecipes(await selectRecipes([...recipes.keys()]), { clean: values.clean });
    for (const source of recipes.values()) remember(source);
    return { id: score.id, score, recipes };
  }
  if (mood) {
    const spec = json ?? { id: input, layers: [{ id: input }] };
    return group({ ...spec, id: spec.id + '-' + mood, mood }, dirname(resolve(input)));
  }
  if (!input.endsWith('.json')) {
    const base = await recipe(input);
    remember(base);
    if (values.clean || values.isolated) await checkIsolatedRecipes(await selectRecipes([input]), {clean:values.clean});
    if (!style) return base;
    return { ...base, id: base.id + '-' + style, macros: { ...sceneStyles[style], ...base.macros } };
  }
  if (!style) return group(input);
  const spec = json;
  return group({ ...spec, id: spec.id + '-' + style, style }, dirname(resolve(input)));
}
function preview(sound, seed) {
  const music = sound.score ? renderMusic(sound.score, { recipes: sound.recipes }) : undefined;
  const rate = music?.report.sampleRate ?? SAMPLE_RATE;
  const channels = music?.channels ?? renderChannels(sound, { seed, level: 'balanced' });
  const start = Math.round(atSec * rate);
  if (start >= channels[0].length) throw Error('--at falls outside ' + sound.id);
  const end = Math.min(channels[0].length, start + 12 * rate);
  if (start === 0 && end === channels[0].length) return { channels, rate };
  return {
    rate,
    channels: channels.map(pcm => {
      const excerpt = pcm.slice(start, end);
      const fade = Math.min(Math.round(0.025 * rate), Math.floor(excerpt.length / 2));
      for (let i = 0; i < fade; i++) {
        if (start > 0) excerpt[i] *= i / fade;
        if (end < pcm.length) excerpt[excerpt.length - 1 - i] *= i / fade;
      }
      return excerpt;
    }),
  };
}
const wav = (channels, rate = SAMPLE_RATE) => Buffer.from(encodeWav(channels, rate)).toString('base64');
const sounds = await Promise.all(
  values.moods ? ['neutral', 'calm', 'dramatic'].map(mood => candidate(inputs[0], undefined, mood)) : values.styles
    ? Object.keys(sceneStyles).map((style) => candidate(inputs[0], style))
    : inputs.map((input) => candidate(input)),
);
if (new Set(sounds.map((r) => r.id)).size !== sounds.length) throw Error('Each candidate needs a distinct ID');
const musicDesk = sounds.some(sound => sound.score);
const takes = sounds.map((sound) =>
  Array.from({ length: musicDesk || sound.preserveTimeline ? 1 : 10 }, (_, i) => {
    const { channels, rate } = preview(sound, DEFAULT_SEED + i * 8191);
    const level = musicDesk ? measureLoudness(channels, rate).integrated : Math.max(...channels.map(c => measureLevel(c, rate).activeDb));
    if (!Number.isFinite(level) || channels.every((c) => c.every((s) => s === 0)))
      throw Error('Silent candidate: ' + sound.id);
    return { channels, rate, level };
  }),
);
const target = Math.min(...takes.flat().map((t) => t.level));
const bank = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8')).sounds;
const revisions = new Map(bank.map(s => [s.id, s.revision ?? 1]));
const choices = sounds.map((sound, index) => ({
  id: sound.id, revision: revisions.get(sound.id),
  takes: takes[index].map(({ channels, rate, level }) =>
    wav(channels.map(c => c.map(s => s * 10 ** ((target - level) / 20) * 0.7)), rate)
  ),
}));
let background = null;
if (values.bed) {
  const bed = await recipe(values.bed);
  if (!bed.loopable) throw Error('Choose a loopable background');
  if(performances.has(bed.id) || bed.components?.some(c=>components.has(c)))
    throw Error('The review background already occurs in a candidate. Audition the existing mix solo.');
  if(values.clean) await checkIsolatedRecipes(await selectRecipes([bed.id]), {clean:true});
  const channels = renderChannels(bed, { level:'balanced' });
  const level = musicDesk ? measureLoudness(channels, SAMPLE_RATE).integrated
    : Math.max(...channels.map(channel => measureLevel(channel, SAMPLE_RATE).activeDb));
  if (!Number.isFinite(level)) throw Error('Silent background: ' + bed.id);
  const gain = Math.min(.27,.7*10**((target-8-level)/20));
  background = wav(channels.map(c=>c.map(x=>x*gain)));
}
if (values.context && !['normal','speech','rapid','hero'].includes(values.context)) throw Error('Choose normal, speech, rapid or hero context');
const data = {
  context: values.context,
  useCase: values['use-case']?.trim(),
  startDry: !background || Boolean(values.clean || values.isolated),
  ...(musicDesk ? { musicDesk: true } : {}),
  choices,
  bedId: values.bed ?? null,
  bed: background,
};
const reel = createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
const payload = JSON.stringify({ reel, ...data }).replaceAll('<', '\\u003c');
const player = await readFile(new URL('./audition-player.js', import.meta.url), 'utf8');
const template = await readFile(new URL('../references/audition.html', import.meta.url), 'utf8');
const path = resolve(values.out);
await mkdir(dirname(path), { recursive: true });
await writeFile(
  path,
  template.replace('__PLAYER__', () => player).replace('__AUDIO__', () => payload),
);
console.log(
  JSON.stringify({
    file: path,
    candidates: sounds.map((r) => r.id),
    takes: musicDesk ? 1 : takes.map(items => items.length),
    ...(musicDesk ? { matchedLufs: target + 20 * Math.log10(0.7), excerptStartSec: atSec } : { matchedActiveDb: target }),
    bed: data.bedId,
  }),
);
