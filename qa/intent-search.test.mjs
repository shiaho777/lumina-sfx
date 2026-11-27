import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rankByIntent } from '../scripts/intent-search.mjs';
import { resolveListeningBrief } from '../scripts/listening-brief.mjs';
import { renderDurationSec } from '../engine/sculpt.ts';
import { loadDesign } from '../scripts/remix-design.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const search = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/search.mjs', ...args, '--json'], {cwd: root}));
assert.equal(search('--intent', 'clicky switch settings tabs', '--isolated', '--limit', '1')[0].id, 'settings-tab-walnut-detent');
assert.equal(search('--designs', '--intent', 'missile phew flying away', '--limit', '1')[0].id, 'missile-departure-whistling-away');
assert.equal(search('--designs', '--intent', 'quiet kill confirm', '--limit', '1')[0].id, 'jet-elimination-dry-latch');
assert.ok(search('--intent', 'toggle on', '--exclude', 'brass', '--limit', '5').every(x => !x.tags.includes('brass')));
assert.equal(search('--intent', 'footsteps on a wooden floor', '--isolated', '--limit', '1')[0].id, 'indoor-hardwood-shoe-step');
const floorMatches = search('--intent', 'wooden floor step without a barn creak', '--isolated', '--limit', '3');
assert.ok(floorMatches.length && floorMatches.every(cue => cue.tags.includes('footstep') && !cue.tags.includes('creak')));
assert.equal(search('--designs', '--intent', 'fire in a thunderstorm', '--limit', '1')[0].id, 'fireside-distant-thunder');
assert.ok(search('--intent', 'ordinary keyboard click', '--limit', '3').every(cue => cue.tags.includes('normal') && cue.tags.includes('single')));
assert.equal(search('--intent', 'silk swipe left', '--limit', '1')[0].id, 'silk-swipe-left');
assert.equal(search('settings-focus-felt-tick').length, 1);
assert.equal(search('--intent', 'gobbledygook').length, 0);
const templates = JSON.parse(await readFile(new URL('../references/scenes/index.json', import.meta.url)));
for (const template of templates) {
  const { recipe } = await loadDesign(root + template.file);
  assert.equal(recipe.id, template.id);
  assert.equal(recipe.isolation, template.isolation);
  assert.equal(recipe.loopable, template.loopable);
  assert.equal(renderDurationSec(recipe), template.durationSec);
}
console.log('Verified intent ranking, filtering, legacy IDs and all editable templates.');

const choose = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/choose.mjs', ...args], { cwd: root }));
assert.equal(choose('thocky mechanical keyboard click', '--isolated').cues[0].id, 'gasket-mount-keyboard-key-down');
assert.equal(choose('settings tab', '--scene').decision, 'single-cue');
assert.equal(choose('silk swipe left','settings tab','--isolated').decision, 'individual-cues');
assert.equal(choose('fire crackle','distant thunder','--scene').scene.id, 'fireside-distant-thunder');
assert.equal(choose('fire crackle','distant thunder','--isolated','--scene').scene.id, 'fireside-distant-thunder');
assert.equal(choose('ceramic jellyfish teleporter').decision, 'review');
assert.deepEqual(choose('heel', 'sole', '--scene', '--isolated').cues.map(c => c.id), ['indoor-hardwood-shoe-step']);
assert.equal(choose('heel', 'heel', '--scene', '--isolated').cues.length, 2);

for (const [query, id] of [
  ['rain only','rainfall-open-air-clean-loop'], ['just thunder','thunder-isolated-rolling-strike'],
  ['cockpit without rain','interceptor-turbofan-canopy-interior-cruise-loop'], ['fire','campfire-crackle-loop'],
  ['light rain','light-rain-loop'], ['heavy rain','heavy-storm-rain-loop'],
]) assert.equal(choose(query,'--clean').cues[0].id, id);
assert.equal(choose('rain only','--clean').cues.length, 1);

const { sounds: bank } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
for (const [prompt, expected] of [
  ['one clean UI click', 'mechanical-ui-click'],
  ['a UI click for my fantasy game', 'mechanical-ui-click'],
  ['menu tab in my jet game', 'settings-tab-walnut-detent'],
  ['switch between tabs in the settings menu', 'settings-tab-walnut-detent'],
  ['understated menu hover', 'settings-focus-felt-tick'],
  ['panel slides into view', 'silk-swipe-right'],
  ['logo sting', 'logo-felt-signature'],
  ['cinematic product trailer impact', 'clean-title-reveal-with-soft-hit'],
  ['trailer riser', 'silk-title-rise'],
  ['soft logo outro', 'delicate-logo-close'],
  ['title card lands', 'paper-title-card-seat'],
  ['high energy product trailer transition', 'celluloid-whip-cut'],
  ['quick swish for a product demo', 'silk-whip-cut'],
  ['left to right swipe for a trailer', 'silk-swipe-right'],
  ['right to left swipe for a trailer', 'silk-swipe-left'],
  ['typed word in a product demo', 'gasket-mount-keyboard-typed-word'],
  ['single mouse click in a product video', 'desktop-mouse-press'],
  ['a toggle turns off', 'settings-toggle-off-cork'],
  ['soft UI notification', 'menu-confirm-pluck'],
]) {
  const matches = rankByIntent(bank, prompt, '', true);
  assert.equal(matches[0]?.id, expected, prompt);
  assert.deepEqual(matches[0].missing, [], prompt);
  assert.ok(matches.every(s => s.editorialAction && s.isolation === 'isolated' && !s.cleanHold && !s.auditionNote), prompt);
}
assert.equal(choose('clean professional trailer').decision, 'review');
assert.equal(rankByIntent(bank, 'epic cinematic trailer sound').length, 0);
assert.equal(choose('a portal opening in a product trailer', '--clean').cues[0].id, 'portal-unfold');
assert.equal(choose('farm-trailer-coupling').cues[0].id, 'farm-trailer-coupling');
assert.equal(rankByIntent(bank, 'tractor trailer coupling')[0].id, 'farm-trailer-coupling');
assert.equal(choose('keyboard typing', 'silk swipe left', 'title card lands', '--scene', '--clean').scene.id, 'product-trailer-interface-edit');
const resolved = resolveListeningBrief({ schemaVersion:2, scope:'mixed', layers:[
  {label:'contact', query:'clean UI click', prefer:'portal', exclude:'sci-fi'},
]}, bank);
assert.equal(resolved.design.layers[0].id, 'mechanical-ui-click');
const held = bank.map(s => s.id === 'mechanical-ui-click' ? {...s, cleanHold:['voice']} : s);
assert.equal(rankByIntent(held, 'clean UI click')[0].id, 'desktop-mouse-press');

const temp = await mkdtemp(join(tmpdir(), 'lumina-editorial-votes-'));
try {
  const file = join(temp, 'votes.json');
  const ballots = { 'portal-unfold': {revision:3, decision:'yes'}, 'mechanical-ui-click': {decision:'no'} };
  await writeFile(file, JSON.stringify({votes:ballots}));
  const current = search('--intent', 'clean UI click', '--votes', file);
  assert.equal(current[0].id, 'mechanical-ui-click');
  assert.equal(current[0].review.currentRevision, false);
  assert.ok(current.every(s => s.editorialAction === 'press'));
  ballots['mechanical-ui-click'].revision = current[0].revision;
  await writeFile(file, JSON.stringify({votes:ballots}));
  assert.equal(search('--intent', 'clean UI click', '--votes', file)[0].id, 'desktop-mouse-press');
} finally {
  await rm(temp, {recursive:true, force:true});
}

const profileDir=await mkdtemp(join(tmpdir(),'lumina-palette-'));
try {
  const profileFile=join(profileDir,'project.json');
  await writeFile(profileFile,JSON.stringify({palette:'crisp',useCase:'settings',votes:'ear.json'}));
  await writeFile(join(profileDir,'ear.json'),JSON.stringify({votes:{'settings-subtab-porcelain-tip':{decision:'no',useCase:'trailer'}}}));
  assert.equal(choose('--profile',profileFile,'settings tab').cues[0].id,'settings-subtab-porcelain-tip');
  await writeFile(join(profileDir,'ear.json'),JSON.stringify({votes:{'settings-subtab-porcelain-tip':{decision:'no',useCase:'settings',revision:bank.find(s=>s.id==='settings-subtab-porcelain-tip').revision??1}}}));
  assert.equal(choose('--profile',profileFile,'settings tab').cues[0].id,'settings-tab-walnut-detent');
} finally {await rm(profileDir,{recursive:true,force:true});}
assert.equal(choose('cursor moves across static text').decision,'silence');
assert.equal(choose('a disabled toggle gives no feedback').decision,'silence');
assert.equal(choose('release a UI drag handle').cues[0].editorial.action,'drop');
assert.equal(choose('nothing resembling an uncut sapphire biplane').cues[0].closest,null);
assert.equal(choose('a bell passing the listener').cues[0].spatial.file,'references/listening-scenes/passing-bell.json');
assert.ok(rankByIntent(bank,'pasture birds').some(x=>x.sourceReview==='field'));
assert.ok(!rankByIntent(bank,'pasture without birds').some(x=>x.sourceReview==='field'));
assert.equal(choose('hold the mouse button').cues[0].id, 'desktop-mouse-press');
assert.equal(choose('desktop-mouse-press-and-hold').cues[0].id, 'desktop-mouse-press-and-hold');
const movingFan = choose('dry cockpit moving past the listener').cues[0].spatial.design;
assert.equal(movingFan.layers.length, 1);
assert.ok(movingFan.layers[0].placement.position[0] < 0 && movingFan.layers[0].placement.path[0].position[0] > 0);
assert.ok(choose('a distant rolling jet flyby').cues[0].spatial.design.layers[0].placement.position[2] < -10);
assert.match(choose('rain patter on a loose garage door').cues[0].id, /garage-door-downpour-recedes$/);
assert.ok(!rankByIntent(bank, 'garage door rain').some(s => s.id.endsWith('garage-door-continuous-patter-loop')));

const bikeParts = search('--parts', 'trail-mountain-bike-pedal-engagement');
assert.ok(bikeParts.some(s => s.id === 'bicycle-coasting-freewheel' && s.sharedRecordings.includes('freewheel.wav')));
assert.ok(bikeParts.every(s => s.isolation === 'isolated' && !s.cleanHold && !s.auditionNote));
assert.equal(search('--parts','ocean-breaker-at-a-rock-ledge','--intent','breaking surf')[0].id, 'ocean-shore-break-loop');
