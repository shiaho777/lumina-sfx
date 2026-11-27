import { parseArgs } from 'node:util';
import { basename, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { checkIsolatedRecipes, installRecipes, selectRecipes } from './install-files.mjs';
import { loadRecipes } from './recipes.mjs';
import { validateScene } from '../engine/scene.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  clean: { type: 'boolean' }, isolated: { type: 'boolean' }, dest: { type: 'string' }, help: { type: 'boolean' },
} });
const usage = 'npm run scene:install -- <scene.json> --dest /game/src/audio [--clean | --isolated]';
if (values.help) {
  console.log(usage);
  process.exit(0);
}
if (positionals.length !== 1 || !values.dest) {
  console.error(usage);
  process.exit(1);
}
const scene = JSON.parse(await readFile(positionals[0], 'utf8'));
const name = basename(positionals[0], '.json');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw Error('Use a lowercase hyphenated scene filename');
if(scene.schemaVersion===2){
  const {loadDesign}=await import('./remix-design.mjs');
  let snapshot;
  const {recipe,selected}=await loadDesign(positionals[0],process.cwd(),undefined,x=>{snapshot??=x;});
  if(values.clean || values.isolated) await checkIsolatedRecipes(selected, {clean:values.clean});
  const {checkRecipe}=await import('../qa/check-recipe.mjs');
  const qa=await checkRecipe(recipe,{bothLevels:true});
  if(!qa.pass)throw Error('Scene QA failed: '+JSON.stringify(qa.variants.filter(x=>!x.pass)));
  const {exportSceneReview}=await import('./scene-review.mjs');
  const directory=resolve(values.dest,name);
  const {publishAsset}=await import('./audio-export.mjs');
  for(const file of ['live-listening.ts','spatial.ts'])
    await publishAsset(resolve(directory,file),await readFile(new URL('../engine/'+file,import.meta.url)));
  await exportSceneReview(snapshot,undefined,directory,false);
  console.log(JSON.stringify({pass:true,file:resolve(directory,'scene.json'),player:resolve(directory,'live-listening.ts'),sources:selected.length}));
} else {
const selected = await selectRecipes(scene.cues.map((cue) => cue.id));
if (values.clean || values.isolated) await checkIsolatedRecipes(selected, {clean:values.clean});
const recipes = await loadRecipes(new Set(selected.map((s) => s.id)));
validateScene(scene, new Map(recipes.map((r) => [r.id, r])));
const file = 'scenes/' + name + '.ts';
const source = [
  "import { SfxScene, type SoundRecipe } from '../engine/index.ts';",
  ...selected.map((r, i) => 'import cue' + i + " from '../recipes/" + r.id + ".ts';"),
  '',
  'const recipes: SoundRecipe[] = [' + selected.map((r, i) => 'cue' + i).join(', ') + '];',
  'const bank = new Map(recipes.map(r => [r.id, r]));',
  'const scene = ' + JSON.stringify(scene, null, 2) + ' as const;',
  'export default function createScene(context: BaseAudioContext, output: AudioNode = context.destination) {',
  '  return new SfxScene(context, scene, bank, output);',
  '}',
  '',
].join('\n');
const written = await installRecipes(selected, values.dest, { file, source });
console.log(JSON.stringify({ file: resolve(values.dest, file), written, cues: selected.length }));
}
