import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { composeMusic, musicStyles } from '../engine/music/compose.ts';
import { inspectMusic } from '../engine/music/inspect.ts';
import { arrangeMusic, musicSourceKind } from '../engine/music/plan.ts';
import { prepareMusicRender, renderMusic } from '../engine/music/render.ts';
import { drumSounds, instrumentCatalog, musicSampleRate, qualities, readMusicScore, rooms, sectionRoles, studioSampleRate } from '../engine/music/score.ts';
import { musicPlanTemplate } from '../engine/music/template.ts';
import { encodeWav } from '../engine/wav.ts';
import { digest, publishAudioProject } from './audio-export.mjs';
import { loadMusicRecipes } from './recipes.mjs';

const usage = `Usage
  node scripts/music.mjs compose --dest <directory> [--style ${musicStyles.join('|')}] [--id <id>]
      [--key <key>] [--bpm <number>] [--bars <number>] [--seed <integer>]
      [--progression "<chords>"] [--form "intro:4,main:8,break:4,outro:4"] [--one-shot] [--quality classic|studio] [--no-stems]
  node scripts/music.mjs render <score.json> --dest <directory> [--id <new-id>] [--quality classic|studio] [--no-stems]
  node scripts/music.mjs arrange <plan.json> --dest <directory> [--id <new-id>] [--quality classic|studio] [--no-stems]
  node scripts/music.mjs template [--style <style>] [--id <id>]
  node scripts/music.mjs compile <plan.json>
  node scripts/music.mjs inspect <score.json|plan.json|routing.json>
  node scripts/music.mjs adaptive <routing.json> --dest <directory>
  node scripts/music.mjs instruments

Each project directory contains an editable score, stereo WAV, measurements and optional stems.
Use --id or a different --dest to keep multiple revisions.`;

const commandHelp = {
  compose: `Compose a seeded score from a palette.
  npm run --silent music -- compose --style chamber --form "opening=intro:4,return=main:4" --dest <directory>
  Each section is role:bars or id=role:bars. Roles are ${sectionRoles.join(', ')}.
  Run npm run --silent music -- instruments to list the tracks available in each palette.`,
  arrange: `Write a plan with named sections and reusable note patterns, then arrange it.
  npm run --silent music -- arrange <plan.json> --dest <directory> [--id <id>] [--quality classic|studio] [--no-stems]

  {"version":1,"id":"example","style":"cinematic","bpm":100,"key":"D minor","loop":false,
   "motifs":{"theme":[{"beat":0,"note":"D4","duration":1,"velocity":0.7}]},
   "sections":[{"id":"opening","role":"intro","chords":["Dm","Bb"],
                "statements":[{"track":"piano","motif":"theme","beat":0}]}]}

  One chord sets one bar. Section IDs are kept in the exported score and report.
  A statement replaces that track's backing in its section. Use layer:true to add to it.
  Statements accept transpose (semitones), stretch, strength, articulation and carry:true into the next section.
  Add other instruments with parts, for example {"keys":"electric-piano"} or
  {"tick":{"instrument":"recipe","recipe":"settings-tab-walnut-detent"}}. Use note:"hit" for percussion or set root for pitched notes.
  Set backing:false to use only the declared parts.
  A section key changes its Roman chords and degree notes. Use @pivot or @dominant on the preceding last bar.
  Use a section's mute array to remove backing tracks. Use mix to adjust named tracks.
  Run npm run --silent music -- instruments, then npm run --silent music -- inspect <plan.json>.`,
  render: `npm run --silent music -- render <score.json> --dest <directory> [--id <id>] [--quality classic|studio] [--no-stems]
Score sections use {"id":"opening","role":"intro","bars":4}. The ID is optional and the role describes the section.
Render a saved score with a new ID to retain both versions.`,
  inspect: 'npm run --silent music -- inspect <score.json|plan.json|routing.json>\nCheck arrangement or adaptive handoffs without rendering audio.',
  template: `npm run --silent music -- template [--style ${musicStyles.join('|')}] [--id <id>]\nWrites an editable phrase and arrangement to stdout.`,
  compile: 'npm run --silent music -- compile <plan.json>\nValidates and writes the resolved score to stdout without rendering audio.',
  adaptive: `npm run --silent music -- adaptive <routing.json> --dest <directory>
Map game states to named sections of a local score or plan. Export a bank, playback helper and optional preview.
Transitions can wait for a beat, bar or section end, or start immediately. Harmonic entry matches chords before overlapping sections.
See references/music/observatory-adaptive.json for state, intensity and preview events.`,
  instruments: 'npm run --silent music -- instruments\nPrints instrument IDs, ranges, articulations, room and quality options, and each palette’s track IDs.',
};

const commonFlags = {
  dest: { type: 'string' },
  id: { type: 'string' },
  quality: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  'no-stems': { type: 'boolean' },
};

function numeric(text, name) {
  if (text === undefined) return undefined;
  if (!text.trim() || !Number.isFinite(Number(text))) throw Error(name + ' must be a number');
  return Number(text);
}

function parseForm(text) {
  if (text === undefined) return undefined;
  return text.split(',').map(part => {
    const [tag, bars, extra] = part.trim().split(':');
    const [id, namedRole, trailing] = tag.split('=');
    const role = namedRole ?? id;
    if (!sectionRoles.includes(role) || !/^\d+$/.test(bars ?? '') || extra !== undefined || trailing !== undefined) {
      throw Error('Invalid section "' + part + '". Use intro:4 or opening=intro:4');
    }
    return { ...(namedRole === undefined ? {} : { id }), role, bars: Number(bars) };
  });
}

async function music(args) {
  const [command, ...rest] = args;
  if (command === '--help' || command === '-h') {
    console.log(usage);
    return;
  }
  if (Object.hasOwn(commandHelp, command) && rest.length === 1 && (rest[0] === '--help' || rest[0] === '-h')) {
    console.log(commandHelp[command]);
    return;
  }
  if (command === 'instruments' && rest.length === 0) {
    const palettes = Object.fromEntries(musicStyles.map(style => [style,
      composeMusic({ style, bars: 1 }).tracks.map(({ id, instrument }) => ({ id, instrument }))]));
    console.log(JSON.stringify({ instruments: instrumentCatalog, drumSounds, rooms, qualities, palettes }, null, 2));
    return;
  }
  if (command === 'template') {
    const { values } = parseArgs({ args: rest, options: { style: { type: 'string' }, id: { type: 'string' } } });
    const template = musicPlanTemplate(values.style ?? 'menu', values.id ?? 'new-cue');
    arrangeMusic(template);
    console.log(JSON.stringify(template, null, 2));
    return;
  }
  if (command === 'compile' && rest.length === 1) {
    const input = JSON.parse(await readFile(rest[0], 'utf8'));
    console.log(JSON.stringify(arrangeMusic(input), null, 2));
    return;
  }
  if (command === 'adaptive') {
    const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { dest: { type: 'string' } } });
    if (positionals.length !== 1 || !values.dest?.trim()) throw Error(commandHelp.adaptive);
    const { publishAdaptiveMusic } = await import('./adaptive-music.mjs');
    console.log(JSON.stringify(await publishAdaptiveMusic(positionals[0], values.dest), null, 2));
    return;
  }
  if (command === 'inspect' && rest.length === 1) {
    const [file] = rest;
    const input = JSON.parse(await readFile(file, 'utf8'));
    const kind = musicSourceKind(input);
    if (kind === 'routing') {
      const { inspectAdaptiveSource } = await import('./adaptive-music.mjs');
      console.log(JSON.stringify(await inspectAdaptiveSource(file, input), null, 2));
      return;
    }
    const score = kind === 'score' ? readMusicScore(input) : arrangeMusic(input);
    if (score.tracks.some(track => track.recipe)) prepareMusicRender(score, await loadMusicRecipes(score));
    const analysis = inspectMusic(score);
    const statements = kind === 'score' ? undefined : input.sections.flatMap(section =>
      (section.statements ?? []).map(statement => ({ section: section.id, ...statement })));
    console.log(JSON.stringify({ ...analysis, ...(statements ? { statements } : {}) }, null, 2));
    return;
  }
  if (command !== 'compose' && command !== 'render' && command !== 'arrange') throw Error(usage);
  const compose = command === 'compose';
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: compose ? {
      ...commonFlags,
      style: { type: 'string' },
      key: { type: 'string' },
      bpm: { type: 'string' },
      bars: { type: 'string' },
      seed: { type: 'string' },
      progression: { type: 'string' },
      form: { type: 'string' },
      'one-shot': { type: 'boolean' },
    } : commonFlags,
  });
  if (values.help) {
    console.log(commandHelp[command]);
    return;
  }
  if (!values.dest?.trim()) throw Error('--dest is required');
  if (positionals.length !== (compose ? 0 : 1)) throw Error(usage);
  let score, plan;
  if (compose) {
    score = composeMusic({
      id: values.id,
      style: values.style,
      key: values.key,
      bpm: numeric(values.bpm, '--bpm'),
      bars: numeric(values.bars, '--bars'),
      seed: numeric(values.seed, '--seed'),
      progression: values.progression,
      sections: parseForm(values.form),
      loop: !values['one-shot'],
      quality: values.quality,
    });
  } else {
    const input = JSON.parse(await readFile(positionals[0], 'utf8'));
    const change = {
      ...(values.id === undefined ? {} : { id: values.id }),
      ...(values.quality === undefined ? {} : { quality: values.quality }),
    };
    if (command === 'arrange') {
      plan = { ...input, ...change };
      score = arrangeMusic(plan);
    } else {
      score = readMusicScore({ ...readMusicScore(input), ...change });
    }
  }

  const studio = score.quality === 'studio';
  const recipes = await loadMusicRecipes(score);
  const rate = studio ? studioSampleRate : musicSampleRate;
  const { project, assets } = await publishAudioProject(values.dest, score.id, write => {
    const wav = (file, channels) => {
      const options = studio ? { bits: 24, ditherSeed: score.seed ^ Number.parseInt(digest(file).slice(0, 8), 16) } : {};
      return write(file, Buffer.from(encodeWav(channels, rate, options)));
    };
    const stems = [];
    const onStem = values['no-stems'] ? undefined : (id, channels) => {
      stems.push({ id, ...wav('stem-' + id + '.wav', channels) });
    };
    const rendered = renderMusic(score, { onStem, recipes });
    const source = write('score.json', JSON.stringify(rendered.score, null, 2) + '\n');
    const master = wav('master.wav', rendered.channels);
    const files = { score: source, master, stems, ...(plan ? { plan: write('plan.json', JSON.stringify(plan, null, 2) + '\n') } : {}) };
    const report = write('report.json', JSON.stringify({ ...rendered.report, files }, null, 2) + '\n');
    return { ...files, report };
  });
  console.log(JSON.stringify({
    directory: project,
    score: join(project, assets.score.file),
    master: join(project, assets.master.file),
    report: join(project, assets.report.file),
    stems: assets.stems.map(stem => join(project, stem.file)),
    ...(assets.plan ? { plan: join(project, assets.plan.file) } : {}),
  }, null, 2));
}

try {
  await music(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
