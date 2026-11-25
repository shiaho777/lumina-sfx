#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { rankByIntent } from './intent-search.mjs';
import { readDesign } from './remix-design.mjs';
import { ROOT } from './recipes.mjs';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  isolated: { type: 'boolean' }, scene: { type: 'boolean' }, exclude: { type: 'string' }, help: { type: 'boolean' },
} });
if (values.help || !positionals.length || positionals.some(q => !q.trim())) {
  console.log('node scripts/choose.mjs "requested cue" ["another cue"] [--scene] [--isolated] [--exclude "words"]');
  process.exit(values.help ? 0 : 1);
}
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const catalog = await read(new URL('../catalog.json', import.meta.url));
const bank = catalog.sounds.filter(s => !values.isolated || s.isolation === 'isolated');
const requests = positionals.map(query => {
  const ranked = rankByIntent(bank, query, values.exclude, true);
  const matches = ranked.filter(s => !s.missing.length || s.id === query);
  return { query, matches: new Set(matches.map(s => s.id)), top: matches[0]?.id,
    closest: ranked[0] && { id: ranked[0].id, unmatchedWords: ranked[0].missing } };
});

function assign(leaves, index, used) {
  if (index === requests.length) return [];
  for (const [i,id] of leaves.entries()) {
    if (used.has(i) || !requests[index].matches.has(id)) continue;
    const rest = assign(leaves, index + 1, new Set([...used, i]));
    if (rest) return [id, ...rest];
  }
}
async function savedScene() {
  if (!values.scene || requests.length < 2) return;
  const index = await read(new URL('../references/scenes/index.json', import.meta.url));
  for (const scene of index) {
    if (values.isolated && scene.isolation !== 'isolated') continue;
    const { leaves } = await readDesign(resolve(ROOT, scene.file));
    if (leaves.length !== requests.length) continue;
    const ids = assign(leaves, 0, new Set());
    if (ids) return { id:scene.id, file:scene.file, sources:ids };
  }
}
const unresolved = requests.some(r => !r.top);
// For a fixed mix, a recorded performance can already contain all requested components.
function completePerformance() {
  if (!values.scene || requests.length < 2) return;
  const phrases = new Set(positionals.map(p => p.trim().toLowerCase()));
  if (phrases.size !== requests.length) return;
  return bank.find(s => s.contains?.length && requests.every(r => r.matches.has(s.id)) &&
    requests.every(r => {
      const content = { id:'', name:s.contains.join(' '), tags:[], category:'' };
      return rankByIntent([content],r.query,values.exclude,true)[0]?.missing.length === 0;
    }));
}
const shared = unresolved ? undefined : completePerformance();
const scene = unresolved || shared ? undefined : await savedScene();
const decision = unresolved ? 'review' : scene ? 'authored-scene' : shared || requests.length === 1 ? 'single-cue' : 'individual-cues';
const cues = shared ? [{ id:shared.id, covers:positionals, contains:shared.contains }] :
  requests.map((r,i) => r.top ? { request:r.query, id:scene?.sources[i] ?? r.top } :
    { request:r.query, closest:r.closest ?? null });
console.log(JSON.stringify({ decision, scene, cues }, null, 2));
