#!/usr/bin/env node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { digest, encodeDelivery, publishAsset } from './audio-export.mjs';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { checkIsolatedRecipes, installRecipes, selectRecipes } from './install-files.mjs';


const usage = `node scripts/remix.mjs <base-id> [base-id ...] --id <new-id> --dest <game/audio>
  node scripts/remix.mjs --spec <design.json> --inspect
  node scripts/remix.mjs <base-id> --inspect
  --punch 0..1 --size 0..1 --distance 0..1 --grit 0..1
  --space dry|small_room|hallway|outdoor_open|canyon_echo|underwater|outdoor|cavern --wetness 0..1 --speed 0.25..4 --pitchShift -24..24
  --fit-seconds N (fit one complete cue to a game animation)
  --params '{"nativeControl":0.7}' (one layer)
  --spec path/to/design.json (per-layer gain, offsetSec and params)
  --mood neutral|calm|dramatic (also applies to the root of --spec)
  --style natural|cinematic|arcade
  --format ts|wav|ogg|opus (default ts)
  --report path/to/report.json (listener-level focus diagnostics for a version 2 scene)
  --stems path/to/stems (dry independent sources, positioned solos and playback manifest)
  --orbit (move a single unmodified catalog performance around the listener on headphones)
  --clean (require isolated sources with no open background-review flag)
  --isolated (require isolated source layers)
  --extremes (also test native control limits)
`;
async function main() {
  const names = ['punch', 'size', 'distance', 'space', 'grit', 'wetness', 'speed', 'pitchShift'];
  const options = Object.fromEntries(
    [...names, 'fit-seconds', 'format', 'spec', 'id', 'name', 'dest', 'report', 'stems', 'params', 'style', 'mood'].map((k) => [k, { type: 'string' }]),
  );
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ...options,
      help: { type: 'boolean' },
      inspect: { type: 'boolean' },
      orbit: { type: 'boolean' },
      clean: { type:'boolean' }, isolated: { type: 'boolean' },
      extremes: { type: 'boolean' },
    },
  });
  if (v.help) {
    console.log(usage);
    return;
  }
  if (v.inspect && (v.dest !== undefined || v.format !== undefined || v.extremes || v.report || v.stems)) {
    throw Error('--inspect reads the design. Omit --dest, --format, --extremes, --report and --stems');
  }
  if (!v.inspect && !v.dest) throw Error('Specify --dest for the target game audio directory');
  const format = v.format ?? 'ts';
  if (!['ts','wav','ogg','opus'].includes(format)) throw Error('Expected --format ts, wav, ogg or opus');
  let spec;
  const fit = v['fit-seconds'];
  if (v.orbit && (v.spec || positionals.length !== 1 || fit || v.params || v.mood || v.style || names.some(k => v[k] !== undefined)))
    throw Error('--orbit takes one catalog id. Use a listening design for a custom trajectory or timing.');
  if (v.spec) {
    if (positionals.length || [fit, v.id, v.name, v.params, v.style, ...names.map((k) => v[k])].some((x) => x !== undefined)) {
      throw Error('Supply the design in either --spec or command-line options');
    }
    spec = v.spec;
  } else {
    if (!positionals.length) throw Error('Choose a source recipe or provide --spec');
    if (fit !== undefined && (positionals.length !== 1 || v.style !== undefined || v.speed !== undefined)) {
      throw Error('--fit-seconds takes one recipe and sets its pace; supply layers or style via --spec');
    }
    if (v.params && positionals.length !== 1) throw Error('Use --spec for DSP overrides on multiple layers');
    const macros = Object.fromEntries(
      names.filter((k) => v[k] !== undefined).map((k) => [k, k === 'space' ? v[k] : Number(v[k] || NaN)]),
    );
    spec = {
      id: v.id ?? (v.inspect ? positionals[0] + '-draft' : undefined),
      name: v.name,
      style: v.style,
      macros: fit === undefined ? macros : undefined,
      layers: positionals.map((id) => ({
        id, params: v.params ? JSON.parse(v.params) : {},
        ...(fit === undefined ? {} : { fitSec: Number(fit), macros }),
      })),
    };
  }
  if(v.orbit){
    const [entry]=await selectRecipes(positionals);
    const {orbitDesign}=await import('./orbit-design.mjs');
    spec=await orbitDesign(entry,{id:entry.id},{id:v.id,name:v.name,clean:v.clean});
  }
  const { loadDesign } = await import('./remix-design.mjs');
  let scene;
  const capture = v.report || v.stems ? value => { scene ??= value; } : undefined;
  const { recipe, selected, source, dependencies, layout } = await loadDesign(spec, process.cwd(), v.mood, capture);
  if (capture && !recipe.preserveTimeline) throw Error('--report and --stems require a version 2 scene');
  if (v.clean || v.isolated) {
    await checkIsolatedRecipes(selected, { clean: v.clean });
    if (recipe.isolation !== 'isolated') throw Error('A source recipe no longer declares isolation');
  }
  if (v.inspect) {
    console.log(JSON.stringify(layout(), null, 2));
    return;
  }
  const { renderDurationSec } = await import('../engine/sculpt.ts');
  const { checkRecipe } = await import('../qa/check-recipe.mjs');
  const temp = await mkdtemp(join(tmpdir(), 'lumina-remix-'));
  let qa, wav;
  try {
    const master = join(temp, 'master.wav');
    qa = await checkRecipe(recipe, { extremes: v.extremes, bothLevels: true, wavPath: master });
    if (qa.pass) {
      wav = await readFile(master);
      if (digest(wav) !== qa.masterSha256) throw Error('QA master checksum mismatch');
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  if (!qa.pass) {
    console.log(
      JSON.stringify({ id: recipe.id, pass: false, variants: qa.variants.filter((x) => !x.pass) }, null, 2),
    );
    process.exitCode = 1;
    return;
  }
  if(capture){
    const {exportSceneReview}=await import('./scene-review.mjs');
    await exportSceneReview(scene,v.report,v.stems);
  }
  if (format !== 'ts') {
    const file = resolve(v.dest, recipe.id + '.' + format);
    const bytes = await encodeDelivery(wav, format);
    await publishAsset(file, bytes);
    console.log(JSON.stringify({ pass: true, id: recipe.id, file, format, isolation: recipe.isolation, masterSha256: qa.masterSha256,
      sha256: digest(bytes), variants: qa.variants.length, credits: [recipe.recording, ...(recipe.additionalRecordings ?? [])].filter(Boolean) }));
    return;
  }
  const file = 'recipes/' + recipe.id + '.ts';
  await installRecipes(selected, v.dest, { file, source, dependencies });
  console.log(
    JSON.stringify(
      {
        pass: true,
        id: recipe.id,
        file: resolve(v.dest, file),
        durationSec: renderDurationSec(recipe),
        isolation: recipe.isolation,
        channels: recipe.renderStereo ? 2 : 1,
        profiles: ['original', 'balanced'],
        variants: qa.variants.length,
        masterSha256: qa.masterSha256,
      },
      null,
      2,
    ),
  );
}

if (!process.features.typescript && !process.execArgv.includes('--experimental-strip-types')) {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', ...process.argv.slice(1)], {
    stdio: 'inherit',
  });
  process.exitCode = child.status ?? 1;
} else {
  try {
    await main();
  } catch (e) {
    console.error(JSON.stringify({ pass: false, error: e.message }));
    process.exitCode = 1;
  }
}
