#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readDesign } from './remix-design.mjs';
import { ROOT } from './recipes.mjs';
import { selectionProfile, listeningVotes } from './selection-profile.mjs';
import {eligibleForIntent} from './source-policy.mjs';
import { observedOriginal, unpackContext } from './edit-context.mjs';
import { ambiguousPenRequest } from './edit-device.mjs';
import { cuePlacement } from './cue-placement.mjs';
import { editorialPurpose, silentGesture } from './editorial-intent.mjs';
import { rankByIntent, rankPerformance } from './intent-search.mjs';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  profile:{type:'string'}, brief:{type:'string'}, palette:{type:'string'}, clean: { type: 'boolean' }, isolated: { type: 'boolean' }, scene: { type: 'boolean' }, exclude: { type: 'string' }, help: { type: 'boolean' },
} });
if (values.help || (!values.brief && !positionals.length) || positionals.some(q => !q.trim())) {
  console.log('node scripts/choose.mjs "requested cue" ["another cue"] [--scene] [--palette soft|crisp] [--clean] [--isolated] [--exclude "words"] or --brief brief.json');
  process.exit(values.help ? 0 : 1);
}
const profile=await selectionProfile(values.profile);
const palette=values.palette??profile.palette;
if(palette && !['soft','crisp'].includes(palette)) throw Error('Choose a soft or crisp palette');
const {votes}=await listeningVotes(profile.votes);
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const catalog = await read(new URL('../catalog.json', import.meta.url));
const bank = catalog.sounds.filter(s => (!values.isolated || s.isolation === 'isolated') && (!values.clean || (s.isolation === 'isolated' && !s.cleanHold && !s.auditionNote)));
if(values.brief){
  if(positionals.length || values.scene || values.exclude || values.palette) throw Error('Supply queries and exclusions inside --brief');
  const {resolveListeningBrief}=await import('./listening-brief.mjs');
  const decision=resolveListeningBrief(JSON.parse(await readFile(values.brief,'utf8')),bank,{palette,votes,useCase:profile.useCase,signatures:profile.signatures});
  console.log(JSON.stringify(decision,null,2));
  process.exit(decision.design || decision.decision==='silence'?0:2);
}
const passBy = /\s+(?:passing|moving|travelling|traveling|flying)\s+(?:past\s+)?(?:the\s+)?listener$/i;
const requests = positionals.map(query => {
  if (observedOriginal(query))return {query,silent:true,reuse:true,matches:new Set()};
  if (silentGesture(query)) return {query, silent:true, matches:new Set()};
  if (ambiguousPenRequest(query))
    return {query,matches:new Set(),missing:['tip contact or barrel button']};
  const solo = /\b(?:only|alone|without)\b/i.test(query) && !/\b(?:menu|ui|settings|trailer)\b/i.test(query);
  const candidates = bank.filter(s => eligibleForIntent(s,query) && (!solo || s.isolation==='isolated'));
  const moving = passBy.test(query);
  const sourceQuery = moving ? query.replace(passBy,'') : query;
  const lookup = moving && /^(?:a |the )?bell$/i.test(sourceQuery.trim()) ? 'phone-ring-bell' : sourceQuery;
  const ranked = rankPerformance(candidates, lookup, values.exclude, votes, {respectVeto:true, palette, signatures:profile.signatures, useCase:profile.useCase});
  const matches = ranked.filter(s => !s.missing.length || s.id === query);
  return { query, moving, matches: new Set(matches.map(s => s.id)), top: matches[0]?.id,
    missing: ranked[0]?.missing,
    closest: matches[0] && {id:matches[0].id} };
});

// Only an exact cover of the requested performances qualifies as a reusable timed scene.
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
const unresolved = requests.some(r => !r.top && !r.silent);
const hasSilence = requests.some(r=>r.silent);
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
const shared = unresolved || hasSilence ? undefined : completePerformance();
const scene = unresolved || shared || hasSilence ? undefined : await savedScene();
const decision = requests.every(r=>r.reuse) ? 'reuse' : requests.every(r=>r.silent) ? (requests.some(r=>r.reuse)?'individual-cues':'silence') : unresolved ? 'review' : scene ? 'authored-scene' : shared || requests.length === 1 ? 'single-cue' : 'individual-cues';
const cues = shared ? [{ id:shared.id, covers:positionals, contains:shared.contains }] :
  requests.map((r,i) => r.top ? { request:r.query, id:scene?.sources[i] ?? r.top } :
    r.silent ? {request:r.query, decision:r.reuse?'reuse':'silence'} : {request:r.query, closest:null, unmatchedWords:r.missing ?? []});
for(const cue of cues) {
  const request=requests.find(r=>r.query===cue.request);
  if (cue.id?.endsWith('mouse-press') && /\bhold\b/i.test(cue.request)) {
    cue.input = { trigger: 'pointerdown', repeatWhileHeld: false };
  }
  const source = bank.find(sound => sound.id === cue.id);
  if(source && request){
    const brief=unpackContext(request.query);
    if(brief.contexts.length || brief.character)cue.performance={contexts:brief.contexts,...(brief.character?{character:brief.character}:{})};
  }
  if (source && request) cue.spatial = cuePlacement(source, request.query, request.moving);

}
// A matched stride supplies one contact. Give agents the entry points for a walk or a live character.
for (const cue of cues) {
  const action = bank.find(s => s.id === cue.id)?.editorialAction;
  if (action) cue.editorial = {action, use:editorialPurpose(action)};
  if (!cue.id?.startsWith('stride-')) continue;
  const source = bank.find(s => s.id === cue.id);
  if (source?.takeCount) cue.movement = {
    surface: cue.id.slice(7), takeCount: source.takeCount, eventsPerPlant: 1,
    sequence: 'scripts/footsteps.mjs', live: 'engine/footsteps.ts', guide: 'references/footsteps.md',
  };
}
const guidance = unresolved && requests.some(r => !r.silent && !r.closest && /\b(?:trailer|video|ui|interface|menu|teaser|promo|demo)\b/i.test(r.query))
  ? 'For a whole demo, inspect the clip or edit timeline and use scripts/score-edit.mjs. With only a brief, ask what visibly changes. For one cue, specify the action.'
  : undefined;
console.log(JSON.stringify({ decision, scene, cues, guidance }, null, 2));
